import { Link, useSearchParams } from "react-router-dom";
import { CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export function OrderSuccess() {
  const [p] = useSearchParams();
  const order = p.get("order");
  return (
    <div className="container flex min-h-[70vh] flex-col items-center justify-center gap-4 text-center">
      <CheckCircle2 className="h-14 w-14 text-emerald-400" />
      <h1 className="text-6xl">{p.get("pending") ? "Payment processing" : "Order confirmed"}</h1>
      <p className="max-w-md text-muted-foreground">{p.get("pending") ? "We're waiting for the bank to confirm your payment. Your order will update automatically once it is confirmed." : "Thank you! Your payment was verified. You'll find shipment updates in your account."}</p>
      <div className="mt-4 flex gap-3">
        {order && <Button asChild><Link to={`/account/orders/${order}`}>View order</Link></Button>}
        <Button variant="outline" asChild><Link to="/shop">Keep shopping</Link></Button>
      </div>
    </div>
  );
}

export function OrderFailure() {
  const [p] = useSearchParams();
  return (
    <div className="container flex min-h-[70vh] flex-col items-center justify-center gap-4 text-center">
      <XCircle className="h-14 w-14 text-destructive" />
      <h1 className="text-6xl">Payment unsuccessful</h1>
      <p className="max-w-md text-muted-foreground">{p.get("reason") || "Something went wrong with your payment."} If money was deducted it will be refunded automatically by your bank or Razorpay.</p>
      <div className="mt-4 flex gap-3"><Button asChild><Link to="/checkout">Try again</Link></Button><Button variant="outline" asChild><Link to="/contact">Contact support</Link></Button></div>
    </div>
  );
}
