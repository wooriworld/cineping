const LETTERBOXD_SEARCH_BASE = 'https://letterboxd.com/search';

/**
 * Open Letterboxd search for a film title in a new tab. When the site
 * matches exactly one film for the query, the opened tab is taken to
 * the corresponding /film/… page; otherwise the tab stays on search results.
 */
export function openLetterboxdSearchByEnglishTitle(englishTitle: string): void {
  const q = englishTitle.trim();
  if (!q) return;
  // Letterboxd search paths use + for spaces (e.g. …/search/Audition+109/)
  const segment = encodeURIComponent(q).replaceAll('%20', '+');
  const url = `${LETTERBOXD_SEARCH_BASE}/${segment}/`;
  window.open(url, '_blank', 'noopener,noreferrer');
}
