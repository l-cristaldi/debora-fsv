pdfjsLib.GlobalWorkerOptions.workerSrc =
  "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";

const pdfUrl = "portfolio_split_hq_compressed.pdf";

let pageFlip;
let currentZoom = 1;
let panX = 0;
let panY = 0;
const zoomStep = 0.25;
const minZoom = 0.5;
const maxZoom = 2.5;

// Drag state
let isDragging = false;
let dragStartX = 0;
let dragStartY = 0;
let dragStartPanX = 0;
let dragStartPanY = 0;

function updateZoomDisplay() {
  const zoomLevel = document.getElementById("zoom-level");
  if (zoomLevel) {
    zoomLevel.textContent = Math.round(currentZoom * 100) + "%";
  }
}

function applyTransform() {
  const bookElement = document.getElementById("book");
  if (bookElement) {
    bookElement.style.transform = `scale(${currentZoom}) translate(${panX}px, ${panY}px)`;
  }
}

function updateCursor() {
  const wrapperElement = document.getElementById("book-wrapper");
  if (wrapperElement) {
    if (currentZoom > 1) {
      wrapperElement.classList.add("draggable");
    } else {
      wrapperElement.classList.remove("draggable");
      // Reset pan when zoom is back to 100%
      panX = 0;
      panY = 0;
    }
  }
}

function updatePageFlipState() {
  if (!pageFlip) return;

  // Completely disable PageFlip mouse events when zoomed > 100%
  if (currentZoom > 1) {
    try {
      pageFlip.updateOptions({ useMouseEvents: false });
    } catch (e) {
      // Fallback: disable pointer events on the book container
      const bookElement = document.getElementById("book");
      if (bookElement) {
        bookElement.style.pointerEvents = "none";
      }
    }
  } else {
    try {
      pageFlip.updateOptions({ useMouseEvents: true });
    } catch (e) {
      // Fallback: re-enable pointer events
      const bookElement = document.getElementById("book");
      if (bookElement) {
        bookElement.style.pointerEvents = "auto";
      }
    }
  }
}

function showPanHint() {
  if (currentZoom > 1) {
    const hint = document.getElementById("pan-hint");
    if (hint) {
      hint.classList.add("show");
      setTimeout(() => hint.classList.remove("show"), 4000);
    }
  }
}

function zoomIn() {
  if (currentZoom < maxZoom) {
    currentZoom = Math.min(maxZoom, currentZoom + zoomStep);
    updateZoomDisplay();
    updateCursor();
    updatePageFlipState();
    applyTransform();
    if (currentZoom > 1) {
      showPanHint();
    }
  }
}

function zoomOut() {
  if (currentZoom > minZoom) {
    currentZoom = Math.max(minZoom, currentZoom - zoomStep);
    updateZoomDisplay();
    updateCursor();
    updatePageFlipState();
    applyTransform();
  }
}

function startDrag(e) {
  if (currentZoom <= 1) return;

  e.preventDefault();
  e.stopPropagation();
  isDragging = true;

  const wrapperElement = document.getElementById("book-wrapper");
  if (wrapperElement) {
    wrapperElement.classList.add("dragging");
  }

  // Handle both mouse and touch events
  const clientX = e.clientX || (e.touches && e.touches[0].clientX);
  const clientY = e.clientY || (e.touches && e.touches[0].clientY);

  dragStartX = clientX;
  dragStartY = clientY;
  dragStartPanX = panX;
  dragStartPanY = panY;
}

function onDrag(e) {
  if (!isDragging || currentZoom <= 1) return;

  e.preventDefault();
  e.stopPropagation();

  // Handle both mouse and touch events
  const clientX = e.clientX || (e.touches && e.touches[0].clientX);
  const clientY = e.clientY || (e.touches && e.touches[0].clientY);

  const deltaX = clientX - dragStartX;
  const deltaY = clientY - dragStartY;

  // Scale the drag distance inversely to zoom level for natural feel
  const dragScale = 1 / currentZoom;

  panX = dragStartPanX + deltaX * dragScale;
  panY = dragStartPanY + deltaY * dragScale;

  applyTransform();
}

function endDrag(e) {
  if (!isDragging) return;

  e.preventDefault();
  e.stopPropagation();

  isDragging = false;
  const wrapperElement = document.getElementById("book-wrapper");
  if (wrapperElement) {
    wrapperElement.classList.remove("dragging");
  }
}

async function loadPDF() {
  try {
    const pdf = await pdfjsLib.getDocument(pdfUrl).promise;
    const bookContainer = document.getElementById("book");
    const pages = [];

    // Render each page ONCE with high quality
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const scale = 2.0; // High quality base scale
      const viewport = page.getViewport({ scale });

      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d");
      canvas.height = viewport.height;
      canvas.width = viewport.width;

      await page.render({ canvasContext: context, viewport }).promise;

      const pageDiv = document.createElement("div");
      pageDiv.classList.add("page");
      pageDiv.appendChild(canvas);
      pages.push(pageDiv);
    }

    // Add all pages to container
    pages.forEach((page) => bookContainer.appendChild(page));

    // Hide loading message
    const loadingEl = document.getElementById("loading");
    if (loadingEl) loadingEl.style.display = "none";

    // Calculate dimensions
    const firstCanvas = pages[0].querySelector("canvas");
    const naturalRatio = firstCanvas.width / firstCanvas.height;

    function computeBookSize() {
      const vh = window.innerHeight;
      const vw = window.innerWidth;

      const availableHeight = Math.max(
        200,
        vh -
          parseInt(
            getComputedStyle(document.documentElement).getPropertyValue(
              "--header-height"
            )
          ) -
          32
      );
      const availableWidth = Math.max(200, vw - 32);

      let width = Math.min(availableWidth * 0.9, 1000);
      let height = width / naturalRatio;

      if (height > availableHeight) {
        height = availableHeight;
        width = height * naturalRatio;
      }

      return { width: Math.floor(width), height: Math.floor(height) };
    }

    const size = computeBookSize();

    // Initialize PageFlip ONCE
    pageFlip = new St.PageFlip(bookContainer, {
      width: size.width,
      height: size.height,
      size: "stretch",
      minWidth: 280,
      maxWidth: size.width,
      minHeight: Math.round(280 / naturalRatio),
      maxHeight: size.height,
      showCover: true,
      flippingTime: 700,
      useMouseEvents: true,
    });

    pageFlip.loadFromHTML(pages);

    // Set up zoom controls
    document.getElementById("zoom-in").addEventListener("click", zoomIn);
    document.getElementById("zoom-out").addEventListener("click", zoomOut);
    updateZoomDisplay();

    // Set up drag controls on the wrapper
    const bookWrapper = document.getElementById("book-wrapper");

    // Mouse events
    bookWrapper.addEventListener("mousedown", startDrag);
    document.addEventListener("mousemove", onDrag);
    document.addEventListener("mouseup", endDrag);

    // Touch events for mobile
    bookWrapper.addEventListener("touchstart", startDrag, {
      passive: false,
    });
    document.addEventListener("touchmove", onDrag, { passive: false });
    document.addEventListener("touchend", endDrag, { passive: false });

    // Block all click events on the book when zoomed
    bookContainer.addEventListener(
      "click",
      (e) => {
        if (currentZoom > 1) {
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();
        }
      },
      true
    );

    // Block all mousedown events on the book when zoomed
    bookContainer.addEventListener(
      "mousedown",
      (e) => {
        if (currentZoom > 1) {
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();
        }
      },
      true
    );

    // Mouse wheel zoom support
    bookWrapper.addEventListener("wheel", (e) => {
      e.preventDefault();
      if (e.deltaY < 0) {
        zoomIn();
      } else {
        zoomOut();
      }
    });

    // Prevent context menu when zoomed
    bookContainer.addEventListener("contextmenu", (e) => {
      if (currentZoom > 1) {
        e.preventDefault();
      }
    });
  } catch (error) {
    console.error("Error loading PDF:", error);
    const loadingEl = document.getElementById("loading");
    if (loadingEl)
      loadingEl.textContent = "Error loading PDF: " + error.message;
  }
}

document.addEventListener("DOMContentLoaded", loadPDF);
