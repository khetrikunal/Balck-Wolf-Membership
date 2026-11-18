import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { QueryBoundary } from "@/components/common/States";
import { AdminTitle, Stat, Table } from "@/components/admin/ui";
import { adminStats } from "@/services/admin";
import { formatDateTime, formatINR } from "@/lib/utils";
import { Link } from "react-router-dom";

export default function Dashboard() {
  const q = useQuery({ queryKey: ["admin", "stats"], queryFn: adminStats });
  return (<><AdminTitle title="Dashboard" />
    <QueryBoundary query={q}>{(s) => (<div className="space-y-8">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Total revenue" value={formatINR(s.total_revenue)} hint="Paid product & custom orders" />
        <Stat label="Total orders" value={s.total_orders} />
        <Stat label="Customers" value={s.total_customers} />
        <Stat label="Pending custom requests" value={<Link to="/admin/custom-requests">{s.pending_custom_requests}</Link>} />
        <Stat label="Active memberships" value={s.active_memberships} />
        <Stat label="Expired memberships" value={s.expired_memberships} />
        <Stat label="Membership revenue" value={formatINR(s.membership_revenue)} />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card><CardHeader><CardTitle>Best-selling products</CardTitle></CardHeader><CardContent>
          {s.best_sellers.length === 0 ? <p className="text-sm text-muted-foreground">No sales yet.</p> : <ul className="space-y-2 text-sm">{s.best_sellers.map((b: any) => <li key={b.name} className="flex justify-between"><span>{b.name}</span><span className="text-muted-foreground">{b.units} sold</span></li>)}</ul>}</CardContent></Card>
        <Card><CardHeader><CardTitle>Low-stock products</CardTitle></CardHeader><CardContent>
          {s.low_stock.length === 0 ? <p className="text-sm text-muted-foreground">Stock levels look healthy.</p> : <ul className="space-y-2 text-sm">{s.low_stock.map((b: any, i: number) => <li key={i} className="flex justify-between"><span>{b.name} · {b.size}/{b.color}</span><span className={b.stock === 0 ? "text-destructive" : "text-amber-400"}>{b.stock} left</span></li>)}</ul>}</CardContent></Card>
      </div>
      <section><h2 className="mb-3 text-3xl">Recent orders</h2>
        {s.recent_orders.length === 0 ? <p className="text-sm text-muted-foreground">No orders yet.</p> : (
          <Table head={["Order", "Date", "Status", "Total"]}>{s.recent_orders.map((o: any) => (
            <tr key={o.id}><td className="font-semibold">{o.order_number}</td><td>{formatDateTime(o.created_at)}</td><td><Badge status={o.status} /></td><td>{formatINR(o.total)}</td></tr>))}</Table>)}</section>
    </div>)}</QueryBoundary></>);
}
