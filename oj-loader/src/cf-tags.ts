import { getHideCodeforcesTags } from "./lib/settings";

const ROOT_CLASS = "oj-loader-hide-tags";
const KEEP_CLASS = "oj-loader-rating-tag";

function markRatingTags(): void {
  for (const tag of document.querySelectorAll(".tag-box")) {
    if (/^\*\d+$/u.test((tag.textContent ?? "").trim())) {
      tag.classList.add(KEEP_CLASS);
    }
  }
}

void getHideCodeforcesTags().then((enabled) => {
  if (!enabled) {
    return;
  }
  const style = document.createElement("style");
  const hidden = `.tag-box:not(.${KEEP_CLASS})`;
  style.textContent = `html.${ROOT_CLASS} ${hidden}, html.${ROOT_CLASS} .roundbox:not(.sidebox):has(${hidden}) { display: none !important; }`;
  document.documentElement.append(style);
  document.documentElement.classList.add(ROOT_CLASS);
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", markRatingTags, { once: true });
  } else {
    markRatingTags();
  }
});
