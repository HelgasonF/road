-- Each authenticated SELECT has one policy that preserves the existing
-- staff-or-driver visibility. Keep staff mutations as separate policies.

drop policy "Staff can read profiles" on public.profiles;
drop policy "Users can read own profile" on public.profiles;
create policy "Staff or owner can read profiles" on public.profiles
for select to authenticated
using ((select public.is_staff()) or id = (select auth.uid()));

drop policy "Staff can read capabilities" on public.capabilities;
drop policy "Drivers can read capabilities" on public.capabilities;
create policy "Staff or drivers can read capabilities" on public.capabilities
for select to authenticated
using ((select public.is_staff()) or (select public.is_driver()));

drop policy "Staff can read operators" on public.operators;
drop policy "Drivers can read own operator" on public.operators;
create policy "Staff or owner can read operators" on public.operators
for select to authenticated
using ((select public.is_staff()) or id = (select public.current_operator_id()));

drop policy "Staff can read vehicles" on public.vehicles;
drop policy "Drivers can read own vehicles" on public.vehicles;
create policy "Staff or owner can read vehicles" on public.vehicles
for select to authenticated
using ((select public.is_staff()) or operator_id = (select public.current_operator_id()));

drop policy "Staff can read operator capabilities" on public.operator_capabilities;
drop policy "Drivers can read own operator capabilities" on public.operator_capabilities;
create policy "Staff or owner can read operator capabilities" on public.operator_capabilities
for select to authenticated
using ((select public.is_staff()) or operator_id = (select public.current_operator_id()));

drop policy "Staff can read vehicle capabilities" on public.vehicle_capabilities;
drop policy "Drivers can read own vehicle capabilities" on public.vehicle_capabilities;
create policy "Staff or owner can read vehicle capabilities" on public.vehicle_capabilities
for select to authenticated
using (
  (select public.is_staff())
  or exists (
    select 1 from public.vehicles vehicle
    where vehicle.id = vehicle_capabilities.vehicle_id
      and vehicle.operator_id = (select public.current_operator_id())
  )
);

drop policy "Staff manage jobs" on public.jobs;
drop policy "Drivers can read assigned jobs" on public.jobs;
create policy "Staff or assigned driver can read jobs" on public.jobs
for select to authenticated
using ((select public.is_staff()) or (select public.driver_has_job(id)));
create policy "Staff can insert jobs" on public.jobs
for insert to authenticated with check ((select public.is_staff()));
create policy "Staff can update jobs" on public.jobs
for update to authenticated
using ((select public.is_staff())) with check ((select public.is_staff()));
create policy "Staff can delete jobs" on public.jobs
for delete to authenticated using ((select public.is_staff()));

drop policy "Staff manage job requirements" on public.job_required_capabilities;
drop policy "Drivers can read assigned job requirements" on public.job_required_capabilities;
create policy "Staff or assigned driver can read job requirements" on public.job_required_capabilities
for select to authenticated
using ((select public.is_staff()) or (select public.driver_has_job(job_id)));
create policy "Staff can insert job requirements" on public.job_required_capabilities
for insert to authenticated with check ((select public.is_staff()));
create policy "Staff can update job requirements" on public.job_required_capabilities
for update to authenticated
using ((select public.is_staff())) with check ((select public.is_staff()));
create policy "Staff can delete job requirements" on public.job_required_capabilities
for delete to authenticated using ((select public.is_staff()));

drop policy "Staff manage job assignments" on public.job_assignments;
drop policy "Drivers can read own assignments" on public.job_assignments;
create policy "Staff or assigned driver can read assignments" on public.job_assignments
for select to authenticated
using ((select public.is_staff()) or operator_id = (select public.current_operator_id()));
create policy "Staff can insert job assignments" on public.job_assignments
for insert to authenticated with check ((select public.is_staff()));
create policy "Staff can update job assignments" on public.job_assignments
for update to authenticated
using ((select public.is_staff())) with check ((select public.is_staff()));
create policy "Staff can delete job assignments" on public.job_assignments
for delete to authenticated using ((select public.is_staff()));

drop policy "Staff manage job status history" on public.job_status_history;
drop policy "Drivers can read assigned job history" on public.job_status_history;
create policy "Staff or assigned driver can read job history" on public.job_status_history
for select to authenticated
using ((select public.is_staff()) or (select public.driver_has_job(job_id)));
create policy "Staff can insert job status history" on public.job_status_history
for insert to authenticated with check ((select public.is_staff()));
create policy "Staff can update job status history" on public.job_status_history
for update to authenticated
using ((select public.is_staff())) with check ((select public.is_staff()));
create policy "Staff can delete job status history" on public.job_status_history
for delete to authenticated using ((select public.is_staff()));
