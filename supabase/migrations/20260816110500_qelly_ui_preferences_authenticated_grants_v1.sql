-- Restore the table privileges required by the authenticated preference facade.
-- Row-level security remains the authorization boundary: users can only access
-- their own preference rows for workspaces they are permitted to use.

revoke all on table public.qelly_ui_preferences from anon;

grant select, insert, update, delete
on table public.qelly_ui_preferences
to authenticated;
