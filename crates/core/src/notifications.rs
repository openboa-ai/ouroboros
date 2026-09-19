//! Human-owned acknowledgments over existing, currently visible source records.
//! Reads never create notifications, dispatch work, emit events or change authority revision.
use super::*;

fn event_ids(ids: &[String]) -> Result<Vec<i64>> {
    if ids.is_empty() || ids.len() > 100 {
        return Err(Error::Invalid);
    }
    let mut values = Vec::with_capacity(ids.len());
    for id in ids {
        let value = id
            .strip_prefix("event:")
            .and_then(|value| value.parse::<i64>().ok())
            .filter(|value| *value > 0)
            .ok_or(Error::Invalid)?;
        if id != &format!("event:{value}") {
            return Err(Error::Invalid);
        }
        values.push(value);
    }
    values.sort_unstable();
    values.dedup();
    if values.len() != ids.len() {
        return Err(Error::Invalid);
    }
    Ok(values)
}

fn page_cursor(cursor: Option<&str>, prefix: &str, current: i64) -> Result<(i64, i64)> {
    let Some(cursor) = cursor else {
        return Ok((current, current.checked_add(1).ok_or(Error::Unavailable)?));
    };
    let tail = cursor.strip_prefix(prefix).ok_or(Error::Conflict)?;
    let (high, before) = tail.split_once(':').ok_or(Error::Invalid)?;
    let high = high.parse::<i64>().map_err(|_| Error::Invalid)?;
    let before = before.parse::<i64>().map_err(|_| Error::Invalid)?;
    if high < 0 || high > current || before < 0 || before > high {
        return Err(Error::Conflict);
    }
    Ok((high, before))
}

impl Core {
    async fn notification_roots(
        &self,
        tx: &mut Transaction<'_, Postgres>,
        ctx: &ActorContext,
        action: &str,
    ) -> Result<Vec<Uuid>> {
        let grants = match self.action_grants(tx, ctx, action).await {
            Ok(grants) => grants,
            Err(Error::Denied) => return Ok(vec![]),
            Err(error) => return Err(error),
        };
        let bases = self.actor_roots(tx, ctx).await?;
        let mut out = Vec::new();
        for grant in grants {
            let constraints = self.grant_work_roots(tx, grant).await?;
            for base in &bases {
                let mut root = *base;
                let mut allowed = true;
                for bound in &constraints {
                    if self.work_descends(tx, root, *bound).await? {
                        continue;
                    }
                    if self.work_descends(tx, *bound, root).await? {
                        root = *bound;
                    } else {
                        allowed = false;
                        break;
                    }
                }
                if allowed && !out.contains(&root) {
                    out.push(root);
                }
            }
        }
        Ok(out)
    }

    async fn notification_data(
        &self,
        tx: &mut Transaction<'_, Postgres>,
        ctx: &ActorContext,
        high: i64,
        before: i64,
        ids: &[i64],
    ) -> Result<Value> {
        let inspect = self.readable_roots(tx, ctx).await?;
        let messages = self
            .notification_roots(tx, ctx, "conversation.read")
            .await?;
        let global = self.unscoped_inspect(tx, ctx).await?;
        Ok(sqlx::query_scalar(include_str!("notifications.sql"))
            .bind(self.firm)
            .bind(ctx.principal)
            .bind(inspect)
            .bind(messages)
            .bind(global)
            .bind(high)
            .bind(before)
            .bind(ids)
            .fetch_one(&mut **tx)
            .await?)
    }

    pub async fn notifications(
        &self,
        actor: impl Into<Actor>,
        cursor: Option<&str>,
    ) -> Result<Value> {
        let mut tx = self.fence().await?;
        let ctx = self.actor_context(&mut tx, &actor.into()).await?;
        if ctx.bound.is_some() {
            return Err(Error::Denied);
        }
        let firm=sqlx::query("SELECT revision,event_sequence,to_jsonb(statement_timestamp()) AS observed_at FROM firms WHERE id=$1")
            .bind(self.firm).fetch_one(&mut *tx).await?;
        let revision: i64 = firm.get("revision");
        let prefix = format!("{}/{}:{revision}:notifications:", self.firm, ctx.principal);
        let (high, before) = page_cursor(cursor, &prefix, firm.get("event_sequence"))?;
        let mut data = self
            .notification_data(&mut tx, &ctx, high, before, &[])
            .await?;
        let items = data["items"].as_array_mut().ok_or(Error::Unavailable)?;
        let more = items.len() > 50;
        items.truncate(50);
        let last = items
            .last()
            .and_then(|item| item["sequence"].as_i64())
            .unwrap_or(0);
        let next = format!("{prefix}{high}:{last}");
        Ok(
            json!({"firm_id":self.firm,"principal_id":ctx.principal,"items":data["items"],"unread":data["unread"],
            "snapshot_sequence":high,"authority_revision":revision,"cursor":cursor,"next_cursor":if more {Some(next.clone())} else {None},
            "has_more":more,"source":"core_notifications","observed_at":firm.get::<Value,_>("observed_at")}),
        )
    }

    pub async fn read_notifications(
        &self,
        actor: impl Into<Actor>,
        ids: &[String],
    ) -> Result<Value> {
        let selected = event_ids(ids)?;
        let mut tx = self.fence().await?;
        let ctx = self.actor_context(&mut tx, &actor.into()).await?;
        if ctx.bound.is_some() {
            return Err(Error::Denied);
        }
        let firm = sqlx::query("SELECT revision,event_sequence FROM firms WHERE id=$1")
            .bind(self.firm)
            .fetch_one(&mut *tx)
            .await?;
        let high: i64 = firm.get("event_sequence");
        let before = high.checked_add(1).ok_or(Error::Unavailable)?;
        let visible = self
            .notification_data(&mut tx, &ctx, high, before, &selected)
            .await?;
        if visible["selected"]
            .as_array()
            .ok_or(Error::Unavailable)?
            .len()
            != selected.len()
        {
            return Err(Error::NotFound);
        }
        // The selected source IDs are the stable request keys. Never update an existing receipt.
        sqlx::query("INSERT INTO owner_notification_reads(firm_id,principal_id,event_sequence) SELECT $1,$2,unnest($3::bigint[]) ON CONFLICT DO NOTHING")
            .bind(self.firm).bind(ctx.principal).bind(&selected).execute(&mut *tx).await?;
        let after = self
            .notification_data(&mut tx, &ctx, high, before, &selected)
            .await?;
        let read_at:Value=sqlx::query_scalar("SELECT to_jsonb(max(read_at)) FROM owner_notification_reads WHERE firm_id=$1 AND principal_id=$2 AND event_sequence=ANY($3)")
            .bind(self.firm).bind(ctx.principal).bind(&selected).fetch_one(&mut *tx).await?;
        tx.commit().await?;
        Ok(
            json!({"firm_id":self.firm,"principal_id":ctx.principal,"ids":ids,"items":after["selected"],"read_at":read_at,
            "unread":after["unread"],"snapshot_sequence":high,"authority_revision":firm.get::<i64,_>("revision"),"source":"core_notifications"}),
        )
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn source_ids_are_fixed_positive_unique_and_bounded() {
        assert_eq!(
            event_ids(&["event:9".into(), "event:2".into()]).unwrap(),
            vec![2, 9]
        );
        for ids in [
            vec![],
            vec!["event:0".into()],
            vec!["event:01".into()],
            vec!["event:-1".into()],
            vec!["event:2".into(); 2],
            vec!["other:1".into()],
            (1..=101).map(|id| format!("event:{id}")).collect(),
        ] {
            assert!(matches!(event_ids(&ids), Err(Error::Invalid)));
        }
    }
    #[test]
    fn notification_cursor_binds_identity_authority_and_snapshot() {
        let prefix = "firm/owner:7:notifications:";
        assert_eq!(page_cursor(None, prefix, 42).unwrap(), (42, 43));
        assert_eq!(
            page_cursor(Some("firm/owner:7:notifications:42:20"), prefix, 50).unwrap(),
            (42, 20)
        );
        for cursor in [
            "firm/other:7:notifications:42:20",
            "firm/owner:8:notifications:42:20",
            "firm/owner:7:notifications:51:20",
            "firm/owner:7:notifications:42:43",
            "firm/owner:7:notifications:-1:0",
        ] {
            assert!(page_cursor(Some(cursor), prefix, 50).is_err());
        }
    }
}
