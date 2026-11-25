import { useEffect } from "react";

/**
 * Kích hoạt hiệu ứng chuyển cảnh mượt khi cuộn trang (IntersectionObserver).
 * Tôn trọng prefers-reduced-motion và luôn đảm bảo các phần tử sớm hiển thị
 * dù chạy trên trình duyệt headless hoặc màn hình cao.
 */
export function useScrollReveal(selector = "[data-reveal]") {
  useEffect(() => {
    const nodes = [...document.querySelectorAll(selector)];
    if (!nodes.length) return undefined;

    const reduce = window.matchMedia?.(
      "(prefers-reduced-motion: reduce)",
    )?.matches;
    if (reduce || typeof IntersectionObserver === "undefined") {
      nodes.forEach((n) => n.classList.add("is-visible"));
      return undefined;
    }

    const revealVisible = () => {
      const vh = window.innerHeight || 900;
      nodes.forEach((el) => {
        const rect = el.getBoundingClientRect();
        if (rect.top < vh * 1.08) el.classList.add("is-visible");
      });
    };
    revealVisible();

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.06, rootMargin: "0px 0px 40px 0px" },
    );
    nodes.forEach((n) => {
      if (!n.classList.contains("is-visible")) observer.observe(n);
    });

    // Fail-safe: đảm bảo không thẻ nào bị kẹt ẩn nếu trình duyệt chụp ảnh toàn trang
    const fallbackTimer = setTimeout(() => {
      nodes.forEach((n) => n.classList.add("is-visible"));
    }, 550);

    return () => {
      observer.disconnect();
      clearTimeout(fallbackTimer);
    };
  }, [selector]);
}
