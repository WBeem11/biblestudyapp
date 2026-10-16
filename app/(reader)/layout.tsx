import Link from "next/link";
import { Navigator } from "@/components/navigator/Navigator";
import { NavigatorButton } from "@/components/navigator/NavigatorButton";

export default function ReaderLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <header className="sticky top-0 z-20 border-b border-rule bg-ground/90 pt-[env(safe-area-inset-top,0px)] backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-[84rem] items-center justify-between px-5 sm:px-8">
          <Link href="/" className="font-serif text-lg tracking-tight">
            Bible Study
          </Link>
          <nav className="flex items-center gap-5">
            <Link href="/iconograph" className="hidden text-sm text-muted transition-colors hover:text-text sm:inline">
              Iconograph
            </Link>
            <NavigatorButton />
          </nav>
        </div>
      </header>
      <main className="flex flex-1 flex-col">{children}</main>
      <footer className="border-t border-rule pb-[env(safe-area-inset-bottom,0px)]">
        <div className="mx-auto flex max-w-[84rem] flex-wrap items-center justify-between gap-x-6 gap-y-2 px-5 py-6 text-xs text-muted sm:px-8">
          <span className="small-caps tracking-[0.12em]">Scripture interprets Scripture</span>
          <nav aria-label="Footer" className="flex gap-5">
            <Link href="/search" className="hover:text-text">
              Search
            </Link>
            <Link href="/iconograph" className="hover:text-text">
              Iconograph
            </Link>
            <Link href="/about" className="hover:text-text">
              About & sources
            </Link>
          </nav>
        </div>
      </footer>
      <Navigator />
    </>
  );
}
