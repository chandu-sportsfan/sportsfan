// import Image from "next/image";
// import AdminLayout from "./admin/layout";
// import DashboardPage from "./admin/page";

// export default function Home() {
//   return (
//   <>
//    <AdminLayout />
//    <DashboardPage />
//   </>
//   );
// }


// app/page.tsx
import { redirect } from "next/navigation";

export default function Home() {
  redirect("/admin");
}