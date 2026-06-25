import { useEffect, useRef, useState } from "react";
import * as pdfjsLib from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.mjs?url";
import {
  ChevronLeft,
  ChevronRight,
  Minus,
  Plus,
  RotateCcw,
  Search,
} from "lucide-react";
import { RuleItem, RulesIndex, SearchEntry } from "../types";

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

// PDF.js viewer с подсветкой правил и своим поиском
type Props = {
  file: string;
  target: RuleItem | null;
  rulesIndex: RulesIndex;
  onRuleTarget: (item: RuleItem) => void;
};
type SearchHit = SearchEntry & { excerpt: string };

export default function PdfViewer({
  file,
  target,
  rulesIndex,
  onRuleTarget,
}: Props) {
  const [pdf, setPdf] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [page, setPage] = useState(1);
  const [scale, setScale] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [searchEntries, setSearchEntries] = useState<SearchEntry[]>([]);
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [hitIndex, setHitIndex] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const textLayerRef = useRef<HTMLDivElement>(null);
  const renderIdRef = useRef(0);
  const pinchRef = useRef<{ distance: number; zoom: number } | null>(null);
  const textLayerDisabledRef = useRef(false);
  const renderScale = scale * zoom;

  useEffect(() => {
    // PDF загружается один раз при смене файла
    pdfjsLib.getDocument({ url: file }).promise.then(setPdf);
  }, [file]);

  useEffect(() => {
    // Поиск использует статический индекс для Safari
    fetch("./search-index.json")
      .then((response) => response.json())
      .then((data: { entries: SearchEntry[] }) =>
        setSearchEntries(data.entries ?? []),
      )
      .catch((error) => console.warn("Could not load search index", error));
  }, []);

  useEffect(() => {
    // Deep link меняет текущую страницу
    if (target) setPage(Math.max(1, target.page));
  }, [target]);

  useEffect(() => {
    // Стрелки вверх и вниз листают страницы PDF
    function onKeyDown(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "f") {
        event.preventDefault();
        setSearchOpen(true);
        return;
      }
      if (event.altKey || event.ctrlKey || event.metaKey) return;
      const keys = ["ArrowDown", "ArrowUp", "PageDown", "PageUp", " "];
      if (!keys.includes(event.key)) return;
      const active = document.activeElement;
      if (
        active instanceof HTMLInputElement ||
        active instanceof HTMLTextAreaElement ||
        active instanceof HTMLSelectElement
      )
        return;
      event.preventDefault();
      const direction =
        event.key === "ArrowUp" || event.key === "PageUp" ? -1 : 1;
      setPage((value) =>
        Math.min(pdf?.numPages ?? value, Math.max(1, value + direction)),
      );
    }
    document.addEventListener("keydown", onKeyDown, true);
    return () => document.removeEventListener("keydown", onKeyDown, true);
  }, [pdf]);

  useEffect(() => {
    // Поиск возвращает правила и примеры, а не страницы
    const needle = query.trim().toLocaleLowerCase("ru");
    if (!needle) {
      setHits([]);
      setHitIndex(0);
      return;
    }
    const next: SearchHit[] = [];
    for (const item of searchEntries) {
      const haystack = item.text.toLocaleLowerCase("ru");
      let index = haystack.indexOf(needle);
      while (index !== -1) {
        const start = Math.max(0, index - 42);
        const end = Math.min(item.text.length, index + query.length + 72);
        next.push({
          ...item,
          excerpt: item.text.slice(start, end).replace(/\s+/g, " ").trim(),
        });
        index = haystack.indexOf(needle, index + needle.length);
      }
    }
    setHits(next);
    setHitIndex(0);
  }, [query, searchEntries]);

  function goToHit(index: number) {
    // Переход к найденному правилу включает штатную подсветку
    if (hits.length === 0) return;
    const next = (index + hits.length) % hits.length;
    setHitIndex(next);
    const item = rulesIndex.flat[hits[next].code];
    if (item) onRuleTarget(item);
  }

  useEffect(() => {
    // Pinch-to-zoom работает поверх кнопок масштаба
    const wrap = wrapRef.current;
    if (!wrap) return;
    const distance = (touches: TouchList) =>
      Math.hypot(
        touches[0].clientX - touches[1].clientX,
        touches[0].clientY - touches[1].clientY,
      );
    function onTouchStart(event: TouchEvent) {
      if (event.touches.length === 2)
        pinchRef.current = { distance: distance(event.touches), zoom };
    }
    function onTouchMove(event: TouchEvent) {
      if (event.touches.length !== 2 || !pinchRef.current) return;
      event.preventDefault();
      const next =
        pinchRef.current.zoom *
        (distance(event.touches) / pinchRef.current.distance);
      setZoom(Math.max(0.6, Math.min(3.2, next)));
    }
    function onTouchEnd(event: TouchEvent) {
      if (event.touches.length < 2) pinchRef.current = null;
    }
    wrap.addEventListener("touchstart", onTouchStart, { passive: false });
    wrap.addEventListener("touchmove", onTouchMove, { passive: false });
    wrap.addEventListener("touchend", onTouchEnd);
    wrap.addEventListener("touchcancel", onTouchEnd);
    return () => {
      wrap.removeEventListener("touchstart", onTouchStart);
      wrap.removeEventListener("touchmove", onTouchMove);
      wrap.removeEventListener("touchend", onTouchEnd);
      wrap.removeEventListener("touchcancel", onTouchEnd);
    };
  }, [zoom]);

  useEffect(() => {
    // Автомасштаб подгоняет страницу под доступную область
    if (!pdf || !wrapRef.current) return;
    const wrap = wrapRef.current;
    const resize = async () => {
      const pdfPage = await pdf.getPage(page);
      const viewport = pdfPage.getViewport({ scale: 1 });
      const styles = window.getComputedStyle(wrap);
      const availableWidth =
        wrap.clientWidth -
        parseFloat(styles.paddingLeft) -
        parseFloat(styles.paddingRight);
      const availableHeight =
        wrap.clientHeight -
        parseFloat(styles.paddingTop) -
        parseFloat(styles.paddingBottom);
      if (availableWidth <= 0 || availableHeight <= 0) return;
      const fit = Math.min(
        availableWidth / viewport.width,
        availableHeight / viewport.height,
      );
      setScale(Math.max(0.5, Math.min(2.2, fit)));
    };
    requestAnimationFrame(resize);
    const observer = new ResizeObserver(resize);
    observer.observe(wrap);
    return () => observer.disconnect();
  }, [pdf, page]);

  useEffect(() => {
    // Canvas рендерится с учетом devicePixelRatio
    if (!pdf || !canvasRef.current || !textLayerRef.current) return;
    let cancelled = false;
    const renderId = renderIdRef.current + 1;
    renderIdRef.current = renderId;
    let task: pdfjsLib.RenderTask | null = null;
    pdf
      .getPage(page)
      .then(async (pdfPage) => {
        if (
          cancelled ||
          renderId !== renderIdRef.current ||
          !canvasRef.current ||
          !textLayerRef.current
        )
          return;
        const viewport = pdfPage.getViewport({ scale: renderScale });
        const canvas = canvasRef.current;
        const context = canvas.getContext("2d");
        if (!context) return;
        const outputScale = Math.max(1, window.devicePixelRatio || 1);
        canvas.width = Math.floor(viewport.width * outputScale);
        canvas.height = Math.floor(viewport.height * outputScale);
        canvas.style.width = `${viewport.width}px`;
        canvas.style.height = `${viewport.height}px`;
        setCanvasSize({ width: viewport.width, height: viewport.height });
        context.setTransform(outputScale, 0, 0, outputScale, 0, 0);
        context.clearRect(0, 0, viewport.width, viewport.height);
        task = pdfPage.render({ canvas, canvasContext: context, viewport });
        await task.promise;
        if (
          cancelled ||
          renderId !== renderIdRef.current ||
          !textLayerRef.current
        )
          return;
        const textLayer = textLayerRef.current;
        textLayer.replaceChildren();
        if (!textLayerDisabledRef.current) {
          try {
            const textContent = await pdfPage.getTextContent();
            if (
              cancelled ||
              renderId !== renderIdRef.current ||
              !textLayerRef.current
            )
              return;
            textLayer.style.setProperty("--scale-factor", String(renderScale));
            const layer = new pdfjsLib.TextLayer({
              textContentSource: textContent,
              container: textLayer,
              viewport,
            });
            await layer.render();
            textLayer
              .querySelectorAll("span")
              .forEach((span) => span.setAttribute("tabindex", "-1"));
          } catch (error) {
            textLayerDisabledRef.current = true;
            textLayer.replaceChildren();
            console.warn(
              "PDF text selection layer disabled in this browser",
              error,
            );
          }
        }
      })
      .catch((error) => {
        if (!cancelled && error?.name !== "RenderingCancelledException")
          console.error(error);
      });
    return () => {
      cancelled = true;
      task?.cancel();
    };
  }, [pdf, page, renderScale]);

  return (
    <section className="viewer">
      <div className="viewerControls">
        <div className="pageControls">
          <button
            title="Предыдущая страница"
            disabled={page <= 1}
            onClick={() => setPage((value) => value - 1)}
          >
            <ChevronLeft size={18} />
          </button>
          <span>
            {page} / {pdf?.numPages ?? "..."}
          </span>
          <button
            title="Следующая страница"
            disabled={!pdf || page >= pdf.numPages}
            onClick={() => setPage((value) => value + 1)}
          >
            <ChevronRight size={18} />
          </button>
        </div>
        <div className="zoomControls">
          <button
            title="Уменьшить"
            onClick={() => setZoom((value) => Math.max(0.6, value - 0.1))}
          >
            <Minus size={18} />
          </button>
          <button title="По высоте" onClick={() => setZoom(1)}>
            <RotateCcw size={18} />
          </button>
          <button
            title="Увеличить"
            onClick={() => setZoom((value) => Math.min(2.4, value + 0.1))}
          >
            <Plus size={18} />
          </button>
        </div>
        <button
          className="searchButton"
          title="Поиск"
          onClick={() => setSearchOpen(true)}
        >
          <Search size={18} />
        </button>
      </div>
      {searchOpen && (
        <section className="searchPanel">
          <div className="searchRow">
            <Search size={16} />
            <input
              autoFocus
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter")
                  goToHit(hitIndex + (event.shiftKey ? -1 : 1));
                if (event.key === "Escape") setSearchOpen(false);
              }}
              placeholder="Найти в правилах"
            />
            <button onClick={() => setSearchOpen(false)}>×</button>
          </div>
          <div className="searchMeta">
            {query
              ? `${hits.length} совпадений`
              : `${searchEntries.length || 0} правил проиндексировано`}
          </div>
          {hits.length > 0 && (
            <>
              <div className="searchNav">
                <button onClick={() => goToHit(hitIndex - 1)}>
                  <ChevronLeft size={16} />
                </button>
                <span>
                  {hitIndex + 1} / {hits.length}, {hits[hitIndex].code}
                </span>
                <button onClick={() => goToHit(hitIndex + 1)}>
                  <ChevronRight size={16} />
                </button>
              </div>
              <button
                className="searchExcerpt"
                onClick={() => {
                  const item = rulesIndex.flat[hits[hitIndex].code];
                  if (item) onRuleTarget(item);
                }}
              >
                <strong>{hits[hitIndex].code}</strong> {hits[hitIndex].title}
                <br />
                {hits[hitIndex].excerpt}
              </button>
            </>
          )}
        </section>
      )}
      <div className="canvasWrap" ref={wrapRef} tabIndex={0}>
        <div
          className="pageLayer"
          style={{ width: canvasSize.width, height: canvasSize.height }}
        >
          <canvas ref={canvasRef} />
          {target?.page === page && (
            <div
              className="ruleHighlight"
              style={{
                top: `${Math.max(0, target.y * renderScale - 2)}px`,
                height: `${Math.max(8, (target.highlightHeight ?? 80) * renderScale)}px`,
              }}
            />
          )}
          <div className="textLayer" ref={textLayerRef} />
        </div>
      </div>
    </section>
  );
}
