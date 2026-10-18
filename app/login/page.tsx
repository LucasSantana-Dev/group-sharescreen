import type { Metadata } from "next";
import { LoginPopup } from "./LoginPopup";
import { translate } from "@/lib/i18n";

export const metadata: Metadata = {
  get title() { return translate("common.signIn"); },
  robots: { index: false, follow: false },
};

export default function LoginPage() {
  return (
    <div className="flex flex-1 flex-col bg-zinc-50 dark:bg-black">
      <LoginPopup />
    </div>
  );
}
