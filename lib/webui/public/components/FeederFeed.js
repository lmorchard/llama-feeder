export default class FeederFeed extends HTMLElement {
  constructor() {
    super();
    this.loaded = false;
  }

  connectedCallback() {}

  get apiUrl() {
    const parent = this.closest("feeder-feeds-list");
    return parent.getAttribute("baseApiUrl");
  }

  onVisible() {
    if (this.loaded) return;
    this.loaded = true;
    this.loadFeed();
  }

  async loadFeed() {
    const feedId = this.getAttribute("feedId");
    const url = `${this.apiUrl}/feeds/${feedId}`;
    const response = await fetch(url);
    const { feed, items } = await response.json();

    const itemsContainer = this.querySelector(".items");
    while (itemsContainer.firstChild) {
      itemsContainer.removeChild(itemsContainer.firstChild);
    }

    if (items) {
      for (const item of items) {
        const itemElement = document.createElement("feeder-feed-item");
        itemElement.setAttribute("itemId", item.id);
        itemElement.setAttribute("title", item.title);
        itemElement.setAttribute("link", item.link);
        itemElement.setAttribute("date", item.date);
        itemsContainer.appendChild(itemElement);
      }
    }
  }
}

customElements.define("feeder-feed", FeederFeed);
