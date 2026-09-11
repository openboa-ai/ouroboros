-- Historical registrations remain inert until explicitly registered with continuation provenance.
ALTER TABLE wake_registrations ADD COLUMN continuation_enabled boolean NOT NULL DEFAULT false;
ALTER TABLE wake_registrations ADD COLUMN origin_context jsonb;
ALTER TABLE wake_registrations ADD COLUMN last_checked_at timestamptz;
CREATE TABLE wake_occurrences (
 firm_id uuid NOT NULL, wake_id uuid NOT NULL, execution_intent_id uuid NOT NULL,
 observed_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(firm_id,wake_id), UNIQUE(firm_id,execution_intent_id),
 FOREIGN KEY(firm_id,wake_id) REFERENCES wake_registrations(firm_id,id),
 FOREIGN KEY(firm_id,execution_intent_id) REFERENCES intents(firm_id,id)
);
