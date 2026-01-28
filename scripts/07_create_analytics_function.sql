-- Create efficient analytics function for vendor dashboard
-- This aggregates all vendor analytics in a single query for optimal performance

create or replace function get_vendor_analytics(
  p_vendor_id uuid,
  p_week_ago timestamp with time zone
)
returns table (
  total_views bigint,
  weekly_views bigint,
  product_count bigint
)
language plpgsql
as $$
begin
  return query
  select
    -- Total views across all vendor products
    coalesce(sum(case when pv.id is not null then 1 else 0 end), 0) as total_views,
    -- Weekly views (last 7 days)
    coalesce(sum(case when pv.viewed_at >= p_week_ago then 1 else 0 end), 0) as weekly_views,
    -- Total product count
    count(distinct p.id) as product_count
  from
    products p
    left join product_views pv on pv.product_id = p.id
  where
    p.vendor_id = p_vendor_id;
end;
$$;
