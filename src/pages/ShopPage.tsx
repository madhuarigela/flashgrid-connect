import { ShoppingBag } from "lucide-react";

export default function ShopPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center pb-20">
      <ShoppingBag className="h-16 w-16 text-muted-foreground mb-4" />
      <h2 className="text-lg font-semibold text-foreground mb-1">Shop</h2>
      <p className="text-sm text-muted-foreground">Coming soon</p>
    </div>
  );
}
