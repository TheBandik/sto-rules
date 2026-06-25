import { RulesIndex, RuleItem } from "../types";
import { Code } from "lucide-react";

type Props = {
  index: RulesIndex;
  activeCode?: string;
  onSelect: (item: RuleItem) => void;
};

export default function Toc({ index, activeCode, onSelect }: Props) {
  return (
    // Меню строится из заранее сгенерированного индекса
    <nav className="toc">
      <h1>Справка по СТО</h1>
      {index.toc.map((section) => (
        <details key={section.code} open>
          <summary>
            {section.code}. {section.title}
          </summary>
          {section.items.map((item) => (
            <button
              key={item.code}
              className={
                activeCode === item.code ? "tocItem active" : "tocItem"
              }
              onClick={() => onSelect(item)}
            >
              <span>{item.code}</span>
              <em>{item.title}</em>
            </button>
          ))}
        </details>
      ))}
      <footer className="tocFooter">
        <p>
          <Code className="tocFooterIcon" size={14} /> Разработано{" "}
          <a
            href="https://github.com/TheBandik"
            target="_blank"
            rel="noreferrer"
          >
            Arkadiy Shneider
          </a>
          ,{" "}
          <a href="https://github.com/mvodya" target="_blank" rel="noreferrer">
            Mark Vodyanitskiy
          </a>{" "}
          и др.
        </p>
        <p>{index.version}</p>
        <p>Build: {new Date(index.generatedAt).toLocaleString("ru-RU")}</p>
        <p>Commit: {index.gitCommit}</p>
      </footer>
    </nav>
  );
}
