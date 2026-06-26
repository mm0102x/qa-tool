const WEBHOOK_URL = import.meta.env.VITE_GOOGLE_SHEETS_WEBHOOK_URL;

// Submits via a hidden iframe + form — bypasses CORS entirely.
// Apps Script reads the data from e.parameter.payload (doPost).
export function saveReview(row) {
  return new Promise((resolve, reject) => {
    if (!WEBHOOK_URL) {
      console.warn("VITE_GOOGLE_SHEETS_WEBHOOK_URL not set:", row);
      return resolve({ ok: true, simulated: true });
    }

    const iframeName = `gs_iframe_${Date.now()}`;
    const iframe = document.createElement("iframe");
    iframe.name = iframeName;
    iframe.style.display = "none";
    document.body.appendChild(iframe);

    const form = document.createElement("form");
    form.method = "POST";
    form.action = WEBHOOK_URL;
    form.target = iframeName;

    const input = document.createElement("input");
    input.type = "hidden";
    input.name = "payload";
    input.value = JSON.stringify(row);
    form.appendChild(input);

    document.body.appendChild(form);

    iframe.onload = () => {
      // Clean up after a short delay
      setTimeout(() => {
        iframe.remove();
        form.remove();
      }, 1000);
      resolve({ ok: true });
    };

    iframe.onerror = () => {
      iframe.remove();
      form.remove();
      reject(new Error("Sheet submission failed"));
    };

    form.submit();
  });
}
