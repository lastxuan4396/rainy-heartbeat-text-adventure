const revealItems = document.querySelectorAll(".reveal");
const navLinks = document.querySelectorAll(".main-nav a");
const yearEl = document.getElementById("year");
const trackedLinks = document.querySelectorAll("[data-track]");
const ideaFilterButtons = document.querySelectorAll("[data-idea-filter]");
const ideaCards = document.querySelectorAll("[data-idea-tag]");
const subscribeForm = document.getElementById("subscribe-form");
const contactForm = document.getElementById("contact-form");
const subscribeFeedback = document.getElementById("subscribe-feedback");
const contactFeedback = document.getElementById("contact-feedback");
const copyWechatBtn = document.getElementById("copy-wechat");
const wechatIdEl = document.getElementById("wechat-id");
const backToTopBtn = document.getElementById("back-to-top");
const progressBar = document.getElementById("scroll-progress-bar");
const siteOwnerEmail = document.body.dataset.ownerEmail || "yourname@email.com";
const siteOwnerWechat = document.body.dataset.ownerWechat || "";

const analyticsConfig = {
  plausibleDomain: "",
  gaMeasurementId: ""
};

if (yearEl) {
  yearEl.textContent = String(new Date().getFullYear());
}

if ("IntersectionObserver" in window) {
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("in-view");
        }
      });
    },
    { threshold: 0.18, rootMargin: "0px 0px -10% 0px" }
  );
  revealItems.forEach((item) => observer.observe(item));
} else {
  revealItems.forEach((item) => item.classList.add("in-view"));
}

const sectionMap = [...navLinks]
  .map((link) => {
    const id = link.getAttribute("href");
    if (!id || !id.startsWith("#")) {
      return null;
    }
    const section = document.querySelector(id);
    if (!section) {
      return null;
    }
    return { link, section };
  })
  .filter(Boolean);

const updateScrollProgress = () => {
  if (!progressBar) {
    return;
  }
  const scrollTop = window.scrollY;
  const docHeight = document.documentElement.scrollHeight - window.innerHeight;
  const ratio = docHeight > 0 ? Math.min(100, Math.max(0, (scrollTop / docHeight) * 100)) : 0;
  progressBar.style.width = `${ratio}%`;
};

const updateActiveLink = () => {
  const offset = window.scrollY + 140;
  let current = sectionMap[0]?.link || null;

  sectionMap.forEach(({ link, section }) => {
    if (section.offsetTop <= offset) {
      current = link;
    }
  });

  navLinks.forEach((link) => link.classList.remove("active"));
  current?.classList.add("active");
};

const updateBackToTopVisibility = () => {
  if (!backToTopBtn) {
    return;
  }
  backToTopBtn.classList.toggle("visible", window.scrollY > 380);
};

let scrollTicking = false;
const onScroll = () => {
  if (scrollTicking) {
    return;
  }
  scrollTicking = true;
  window.requestAnimationFrame(() => {
    updateActiveLink();
    updateScrollProgress();
    updateBackToTopVisibility();
    scrollTicking = false;
  });
};

window.addEventListener("scroll", onScroll, { passive: true });
updateActiveLink();
updateScrollProgress();
updateBackToTopVisibility();

const loadPlausible = (domain) => {
  const script = document.createElement("script");
  script.defer = true;
  script.dataset.domain = domain;
  script.src = "https://plausible.io/js/script.js";
  document.head.append(script);
};

const loadGA = (measurementId) => {
  const script = document.createElement("script");
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`;
  document.head.append(script);

  window.dataLayer = window.dataLayer || [];
  window.gtag = function gtag() {
    window.dataLayer.push(arguments);
  };
  window.gtag("js", new Date());
  window.gtag("config", measurementId);
};

if (analyticsConfig.plausibleDomain) {
  loadPlausible(analyticsConfig.plausibleDomain);
}

if (analyticsConfig.gaMeasurementId) {
  loadGA(analyticsConfig.gaMeasurementId);
}

const trackEvent = (name, props = {}) => {
  if (window.plausible) {
    window.plausible(name, { props });
  }
  if (window.gtag) {
    window.gtag("event", name, props);
  }
};

const copyText = async (text) => {
  if (!text) {
    return false;
  }
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
};

trackedLinks.forEach((link) => {
  link.addEventListener("click", () => {
    const eventName = link.dataset.track;
    if (eventName) {
      trackEvent(eventName, { href: link.getAttribute("href") || "" });
    }
  });
});

const applyIdeaFilter = (filterValue) => {
  ideaFilterButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.ideaFilter === filterValue);
  });
  ideaCards.forEach((card) => {
    const tag = card.dataset.ideaTag || "";
    const shouldShow = filterValue === "all" || tag === filterValue;
    card.classList.toggle("is-hidden", !shouldShow);
  });
  trackEvent("idea_filter", { value: filterValue });
};

ideaFilterButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const filterValue = button.dataset.ideaFilter || "all";
    applyIdeaFilter(filterValue);
  });
});

const draftMail = ({ subject, body, feedbackEl, successText }) => {
  if (!siteOwnerEmail || siteOwnerEmail.includes("yourname@")) {
    if (feedbackEl) {
      feedbackEl.textContent = "请先在 index.html 把 yourname@email.com 改成你的真实邮箱。";
    }
    return;
  }
  const mailtoUrl = `mailto:${encodeURIComponent(siteOwnerEmail)}?subject=${encodeURIComponent(
    subject
  )}&body=${encodeURIComponent(body)}`;
  window.location.href = mailtoUrl;
  if (feedbackEl) {
    feedbackEl.textContent = successText;
  }
};

if (subscribeForm && subscribeFeedback) {
  subscribeForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = new FormData(subscribeForm);
    const email = String(data.get("email") || "").trim();

    if (!email) {
      subscribeFeedback.textContent = "请输入有效邮箱。";
      return;
    }

    const cacheKey = "dianjidefan_subscribers";
    const existing = JSON.parse(localStorage.getItem(cacheKey) || "[]");
    const updated = [...existing, { email, date: new Date().toISOString() }];
    localStorage.setItem(cacheKey, JSON.stringify(updated.slice(-100)));

    trackEvent("newsletter_submit", { email_domain: email.split("@")[1] || "unknown" });
    draftMail({
      subject: "垫饥的饭订阅申请",
      body: `订阅邮箱：${email}\n来源：网站订阅表单`,
      feedbackEl: subscribeFeedback,
      successText: "已为你打开邮件草稿，发送后我就能收到订阅请求。"
    });
  });
}

if (contactForm && contactFeedback) {
  contactForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = new FormData(contactForm);
    const name = String(data.get("name") || "").trim();
    const email = String(data.get("email") || "").trim();
    const message = String(data.get("message") || "").trim();

    if (!name || !email || !message) {
      contactFeedback.textContent = "请把信息填写完整。";
      return;
    }

    trackEvent("contact_submit", { email_domain: email.split("@")[1] || "unknown" });
    draftMail({
      subject: `垫饥的饭合作咨询 - ${name}`,
      body: `昵称：${name}\n邮箱：${email}\n\n需求：\n${message}`,
      feedbackEl: contactFeedback,
      successText: "已为你打开合作邮件草稿，发送后我会尽快回复。"
    });
  });
}

if (copyWechatBtn && wechatIdEl) {
  copyWechatBtn.addEventListener("click", async () => {
    const wechatValue = siteOwnerWechat || wechatIdEl.textContent?.trim() || "";
    const copied = await copyText(wechatValue);
    if (copied) {
      contactFeedback.textContent = `微信号已复制：${wechatValue}`;
      trackEvent("copy_wechat", { value: wechatValue });
      return;
    }
    contactFeedback.textContent = `复制失败，请手动添加：${wechatValue}`;
  });
}

if (backToTopBtn) {
  backToTopBtn.addEventListener("click", () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
    trackEvent("back_to_top_click");
  });
}
