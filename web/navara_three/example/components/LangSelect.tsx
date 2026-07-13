import { Languages } from "lucide-react";

import { SUPPORTED_LANGS, type Lang } from "../pages/examples/sections";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";

type LangSelectProps = {
  lang: Lang;
  setLang: (lang: Lang) => void;
  /** Accessible label for the control (localized by the caller). */
  label: string;
};

/**
 * Language picker. A dropdown rather than a two-state toggle so it stays usable
 * as more languages are added. Styled flat/borderless to match the header's
 * ghost buttons.
 */
export const LangSelect = ({ lang, setLang, label }: LangSelectProps) => {
  return (
    <Select value={lang} onValueChange={(value) => setLang(value as Lang)}>
      <SelectTrigger
        aria-label={label}
        className="h-9 w-auto gap-1.5 border-0 bg-transparent px-2 font-medium uppercase text-muted-foreground shadow-none hover:bg-accent hover:text-foreground"
      >
        <Languages className="h-4 w-4" />
        {lang}
      </SelectTrigger>
      <SelectContent align="end" className="min-w-[6rem]">
        {SUPPORTED_LANGS.map((code) => (
          <SelectItem key={code} value={code} className="uppercase">
            {code}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};
