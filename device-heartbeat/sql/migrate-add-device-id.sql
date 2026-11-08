-- Apply to the current MAC-based C2 schema (not legacy mac_no schemas).
-- Stop writers and back up first. No rows or existing foreign keys are removed.
-- Existing primary keys are preserved; both mac and device_id become unique.
\set ON_ERROR_STOP on
BEGIN;
LOCK TABLE devices IN ACCESS EXCLUSIVE MODE;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema=current_schema() AND table_name='devices' AND column_name='mac_no') THEN
    RAISE EXCEPTION 'Legacy mac_no schema: use migrate-v1-to-v2.sql';
  END IF;
  IF EXISTS (SELECT 1 FROM devices WHERE mac IS NULL OR mac !~ '^[0-9A-F]{12}$') THEN
    RAISE EXCEPTION 'Invalid MAC: fix canonical MAC values first';
  END IF;
  IF EXISTS (SELECT 1 FROM devices GROUP BY right(mac, 4) HAVING count(*) > 1) THEN
    RAISE EXCEPTION 'device_id collision: duplicate last four MAC characters';
  END IF;
END $$;

ALTER TABLE devices ADD COLUMN IF NOT EXISTS device_id CHAR(8);
UPDATE devices SET device_id = 'CAM-' || right(mac, 4)
WHERE device_id IS DISTINCT FROM 'CAM-' || right(mac, 4);
ALTER TABLE devices ALTER COLUMN device_id SET NOT NULL;

DO $$ DECLARE column_name text; column_number smallint;
BEGIN
  FOREACH column_name IN ARRAY ARRAY['mac', 'device_id'] LOOP
    SELECT attnum INTO column_number FROM pg_attribute
      WHERE attrelid='devices'::regclass AND attname=column_name;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint
      WHERE conrelid='devices'::regclass AND contype IN ('p','u')
        AND conkey = ARRAY[column_number]) THEN
      EXECUTE format('ALTER TABLE devices ADD CONSTRAINT %I UNIQUE (%I)', 'c2_devices_' || column_name || '_unique', column_name);
    END IF;
  END LOOP;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='devices'::regclass AND conname='c2_devices_id_matches_mac') THEN
    ALTER TABLE devices ADD CONSTRAINT c2_devices_id_matches_mac CHECK (device_id = 'CAM-' || right(mac, 4));
  END IF;
END $$;

CREATE OR REPLACE FUNCTION c2_set_device_id() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.device_id := 'CAM-' || right(NEW.mac, 4);
  RETURN NEW;
END $$;
CREATE OR REPLACE TRIGGER c2_devices_set_id
BEFORE INSERT OR UPDATE OF mac, device_id ON devices
FOR EACH ROW EXECUTE FUNCTION c2_set_device_id();
COMMIT;
