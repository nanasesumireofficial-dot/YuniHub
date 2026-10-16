import Fuse from 'fuse.js';

export function createScriptSearch(scripts) {
  const index = new Fuse(scripts, {
    keys: ['title', 'name', 'description', 'author', 'tags', 'games', 'supportedExecutors'],
    threshold: 0.35,
    ignoreLocation: true
  });

  return (query = '', game = '', executor = '') => {
    const matches = query.trim() ? index.search(query.trim()).map((result) => result.item) : scripts;
    return matches.filter((script) =>
      (!game || script.games.includes(game)) &&
      (!executor || script.supportedExecutors.includes(executor))
    );
  };
}