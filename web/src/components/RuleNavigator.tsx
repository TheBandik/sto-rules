import { useEffect } from "react";
import { RuleItem } from "../types";

type Props = {
  items: RuleItem[];
  active: RuleItem | null;
  onSelect: (item: RuleItem) => void;
};

export default function RuleNavigator({ items, active, onSelect }: Props) {
  // Позиция текущего правила внутри списка из ссылки
  const index = Math.max(
    0,
    items.findIndex((item) => item.code === active?.code),
  );
  const current = items[index] ?? items[0];

  useEffect(() => {
    // Влево и вправо переключают правила из списка
    function onKey(event: KeyboardEvent) {
      if (event.key === "ArrowRight") {
        event.preventDefault();
        onSelect(items[Math.min(items.length - 1, index + 1)]);
      }
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        onSelect(items[Math.max(0, index - 1)]);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [index, items, onSelect]);

  return (
    <section className="ruleNavigator">
      <button disabled={index === 0} onClick={() => onSelect(items[index - 1])}>
        ←
      </button>
      <div>
        <strong>{current.code}</strong>
        <span>
          {index + 1} / {items.length}
        </span>
        <p>{current.title}</p>
      </div>
      <button
        disabled={index === items.length - 1}
        onClick={() => onSelect(items[index + 1])}
      >
        →
      </button>
    </section>
  );
}
