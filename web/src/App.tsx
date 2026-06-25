import { useCallback, useEffect, useState } from "react";
import PdfViewer from "./components/PdfViewer";
import RuleNavigator from "./components/RuleNavigator";
import Toc from "./components/Toc";
import { RulesIndex, RuleItem } from "./types";
import { parseRuleCodes, setRuleHash } from "./urlRules";
import { Download, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { FaGithub } from "react-icons/fa";

export default function App() {
  // Главный индекс управляет TOC, ссылками и поиском
  const [index, setIndex] = useState<RulesIndex | null>(null);
  const [target, setTarget] = useState<RuleItem | null>(null);
  const [selectedCodes, setSelectedCodes] = useState<string[]>([]);
  const [tocOpen, setTocOpen] = useState(false);
  const [tocCollapsed, setTocCollapsed] = useState(false);

  useEffect(() => {
    // После загрузки индекса применяем deep link
    fetch("./rules-index.json")
      .then((response) => response.json())
      .then((data: RulesIndex) => {
        setIndex(data);
        const codes = parseRuleCodes().filter((code) => data.flat[code]);
        setSelectedCodes(codes);
        if (codes[0]) setTarget(data.flat[codes[0]]);
      });
  }, []);

  const goTo = useCallback((item: RuleItem, codes = [item.code]) => {
    // Единая точка перехода к правилу
    setTarget(item);
    setSelectedCodes(codes);
    setRuleHash(codes);
    setTocOpen(false);
  }, []);

  if (!index) return <div className="loading">Загрузка правил СТО...</div>;

  const selectedItems = selectedCodes
    .map((code) => index.flat[code])
    .filter(Boolean);

  return (
    <div className={tocCollapsed ? "app sidebarCollapsed" : "app"}>
      <aside className={tocOpen ? "tocPanel open" : "tocPanel"}>
        <Toc index={index} activeCode={target?.code} onSelect={goTo} />
      </aside>
      {tocOpen && (
        <button
          className="tocBackdrop"
          aria-label="Закрыть меню"
          onClick={() => setTocOpen(false)}
        />
      )}
      <main className="main">
        <header className="topbar">
          <button
            className="menuButton"
            title="Открыть меню"
            aria-label="Открыть меню"
            onClick={() => setTocOpen((value) => !value)}
          >
            <PanelLeftOpen size={18} />
          </button>
          <button
            className="sidebarToggle"
            title={tocCollapsed ? "Показать меню" : "Скрыть меню"}
            onClick={() => setTocCollapsed((value) => !value)}
          >
            {tocCollapsed ? (
              <PanelLeftOpen size={18} />
            ) : (
              <PanelLeftClose size={18} />
            )}
          </button>
          <div>
            <strong>Правила СТО</strong>
            <span>{target ? ` ${target.code}` : " PDF"}</span>
          </div>
          <span className="docVersion">{index.version}</span>
          <a
            className="topIcon"
            href="./sto-rules.pdf"
            download
            title="Скачать PDF"
          >
            <Download size={18} />
          </a>
          <a
            className="topIcon"
            href="https://github.com/TheBandik/sto-rules"
            target="_blank"
            rel="noreferrer"
            title="GitHub"
          >
            <FaGithub size={18} />
          </a>
        </header>
        <PdfViewer
          file="./sto-rules.pdf"
          target={target}
          rulesIndex={index}
          onRuleTarget={(item) => goTo(item)}
        />
        {selectedItems.length > 1 && (
          <RuleNavigator
            items={selectedItems}
            active={target}
            onSelect={(item) => goTo(item, selectedCodes)}
          />
        )}
      </main>
    </div>
  );
}
