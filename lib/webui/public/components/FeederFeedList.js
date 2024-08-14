import FeederFeed from "./FeederFeed.js";

export default class FeederFeedsList extends HTMLElement {
  constructor() {
    super();

    this.mutationObserver = new MutationObserver(
      (records) => this.handleMutations(records)
    );

    this.intersectionObserver = new IntersectionObserver(
      (entries) => this.handleIntersections(entries),
      { threshold: 0.1 }
    );
  }
  
  createRenderRoot() {
    return this;
  }

  connectedCallback() {
    console.log("FeederFeedsList connected.");
    this.mutationObserver.observe(this, {
      subtree: true,
      childList: true,
    });

    for (const node of this.querySelectorAll("feeder-feed")) {
      this.intersectionObserver.observe(node);
    }
  }

  disconnectedCallback() {
    this.intersectionObserver.disconnect();
    this.mutationObserver.disconnect();
  }

  handleMutations(records) {
    for (const record of records) {
      for (const node of record.addedNodes) {
        if (node.nodeType === Node.ELEMENT_NODE) {
          if (node instanceof FeederFeed) {
            this.intersectionObserver.observe(node);
          }
          for (const subnode of node.querySelectorAll(`feeder-feed`)) {
            this.intersectionObserver.observe(subnode);
          }
        }
      }
      for (const node of record.removedNodes) {
        if (node.nodeType === Node.ELEMENT_NODE) {
          if (node instanceof FeederFeed) {
            this.intersectionObserver.unobserve(node);
          }
          for (const subnode of node.querySelectorAll(`feeder-feed`)) {
            this.intersectionObserver.unobserve(subnode);
          }
        }
      }
    }
  }

  handleIntersections(entries) {
    for (const entry of entries) {
      if (entry.isIntersecting && entry.target instanceof FeederFeed) {
        entry.target.onVisible();
      }
    }
  }
}

customElements.define("feeder-feeds-list", FeederFeedsList);
