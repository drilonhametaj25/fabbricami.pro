// Marketing route group layout
// Header/Footer are already in root layout, this just wraps children
export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
