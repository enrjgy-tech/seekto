// Move between views. main.js listens for hash changes and for "seekto:render".
export function go(route) {
  if (location.hash === `#${route}`) window.dispatchEvent(new Event("seekto:render"));
  else location.hash = route;
}
