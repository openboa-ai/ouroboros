-- Notifications are projections of existing events; only personal acknowledgments are stored.
CREATE TABLE owner_notification_reads (
 firm_id uuid NOT NULL, principal_id uuid NOT NULL, event_sequence bigint NOT NULL,
 read_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(firm_id,principal_id,event_sequence),
 FOREIGN KEY(firm_id,principal_id) REFERENCES principals(firm_id,id),
 FOREIGN KEY(firm_id,event_sequence) REFERENCES events(firm_id,sequence)
);
REVOKE ALL ON owner_notification_reads FROM PUBLIC;
