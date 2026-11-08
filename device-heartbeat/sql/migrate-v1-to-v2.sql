-- Run explicitly with psql -v ON_ERROR_STOP=1 -f sql/migrate-v1-to-v2.sql
-- Stop writers and back up first. No automatic migration during application startup.
-- Original data and foreign keys remain attached to devices_legacy_v1.
\set ON_ERROR_STOP on
BEGIN;
LOCK TABLE devices IN ACCESS EXCLUSIVE MODE;
DO $$ BEGIN
  IF to_regclass('devices_legacy_v1') IS NOT NULL THEN RAISE EXCEPTION 'Legacy archive already exists'; END IF;
  IF EXISTS (SELECT 1 FROM devices WHERE mac_no IS NULL OR upper(replace(trim(mac_no), ':', '')) !~ '^[0-9A-F]{12}$') THEN
    RAISE EXCEPTION 'Invalid or synthetic legacy MAC: resolve identities before migration';
  END IF;
  IF EXISTS (SELECT 1 FROM devices GROUP BY upper(replace(trim(mac_no), ':', '')) HAVING count(*) > 1) THEN
    RAISE EXCEPTION 'Duplicate normalized MAC';
  END IF;
  IF EXISTS (SELECT 1 FROM devices GROUP BY right(upper(replace(trim(mac_no), ':', '')), 4) HAVING count(*) > 1) THEN
    RAISE EXCEPTION 'device_id collision: duplicate last four MAC characters';
  END IF;
  IF EXISTS (SELECT 1 FROM devices WHERE vpn_ip IS NOT NULL GROUP BY vpn_ip HAVING count(*) > 1) THEN
    RAISE EXCEPTION 'Duplicate VPN IP';
  END IF;
END $$;
ALTER TABLE devices RENAME TO devices_legacy_v1;
\ir schema.sql
INSERT INTO devices (mac,user_id,name,location,model,firmware_version,wg_pubkey,vpn_ip,is_active,registered_at,created_at,description,storage_used_bytes,latest_event_time,thumbnail_url)
SELECT upper(replace(trim(mac_no), ':', '')),user_id,name,location,model,firmware_version,wg_pubkey,vpn_ip,is_active,registered_at,created_at,COALESCE(description,''),storage_used_bytes,latest_event_time,thumbnail_url
FROM devices_legacy_v1;
-- Reset last_seen/status and fabricated handshake/uptime values; next authenticated
-- heartbeat establishes liveness. Legacy 10.0.0.x IPs require C4 peer/routing migration.
-- Legacy provision_token, serial/code/group metadata and history remain in archive.
COMMIT;
