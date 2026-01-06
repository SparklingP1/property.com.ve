-- Allow service role to insert/update listings
-- This allows our scraper (using service role key) to populate the database

-- Policy for inserting new listings (service role bypasses RLS, but adding for clarity)
create policy "Service role can insert listings"
  on listings for insert
  with check (true);

-- Policy for updating existing listings
create policy "Service role can update listings"
  on listings for update
  using (true);
