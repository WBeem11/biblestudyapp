import { Suspense } from "react";
import { SearchView } from "@/components/search/SearchView";

export const metadata = { title: "Search · Bible Study", description: "Search every verse of the BSB and KJV." };

export default function SearchPage() {
  return (
    <Suspense fallback={<div className="min-h-[85vh]" />}>
      <SearchView />
    </Suspense>
  );
}
