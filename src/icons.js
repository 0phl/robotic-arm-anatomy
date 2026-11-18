const paths={
  atlas:'<path d="m2.5 7.3 9.5-4.8 9.5 4.8-9.5 4.8zM2.5 12l9.5 4.8 9.5-4.8M2.5 16.7l9.5 4.8 9.5-4.8"/>',
  cube:'<path d="m3 7 9-5 9 5v10l-9 5-9-5zM3 7l9 5 9-5m-9 5v10m-4.5-17.5 9 5"/>',
  sliders:'<path d="M4 6h5m4 0h7M4 12h10m4 0h2M4 18h2m4 0h10"/><circle cx="11" cy="6" r="2"/><circle cx="16" cy="12" r="2"/><circle cx="8" cy="18" r="2"/>',
  quiz:'<path d="m2 9 10-5 10 5-10 5zM6 11v5c4 3 8 3 12 0v-5m4-2v7"/>',
  help:'<circle cx="12" cy="12" r="9"/><path d="M9.8 9a2.4 2.4 0 0 1 4.7.6c0 1.9-2.7 2.1-2.7 4m0 2.5h.01"/>',
  pin:'<path d="M19 9c0 5-7 12-7 12S5 14 5 9a7 7 0 1 1 14 0z"/><circle cx="12" cy="9" r="2"/>',
  scan:'<path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5"/><circle cx="12" cy="12" r="3"/>',
  expand:'<path d="M14 4h6v6m0-6-7 7M10 20H4v-6m0 6 7-7"/>',
  shrink:'<path d="M20 4l-7 7m0-6v6h6M4 20l7-7m0 6v-6H5"/>',
  view:'<path d="m3 7 9-5 9 5v10l-9 5-9-5zM3 7l9 5 9-5m-9 5v10"/>',
  chevronDown:'<path d="m7 10 5 5 5-5"/>',minus:'<path d="M5 12h14"/>',plus:'<path d="M5 12h14m-7-7v14"/>',
  reset:'<path d="M4 10a8 8 0 1 1 .5 6M4 4v6h6"/>',
  orbit:'<circle cx="12" cy="12" r="3"/><ellipse cx="12" cy="12" rx="10" ry="5" transform="rotate(-30 12 12)"/>',
  pointer:'<path d="m4 3 15 8-7 2-3 7z"/>',
  left:'<path d="m14 6-6 6 6 6"/>',right:'<path d="m10 6 6 6-6 6"/>',
  arrowUpRight:'<path d="M6 18 18 6m-9 0h9v9"/>',
  close:'<path d="m6 6 12 12m0-12L6 18"/>',speaker:'<path d="M3 9h4l5-4v14l-5-4H3zM15 9a4 4 0 0 1 0 6m2-9a8 8 0 0 1 0 12"/>',
  pause:'<path d="M8 5v14m8-14v14" stroke-width="3"/>',isolate:'<path d="M7 3H3v4m14-4h4v4M3 17v4h4m14-4v4h-4m-11-12 6-3 6 3v6l-6 3-6-3z"/>',
  light:'<path d="M8 15c0-2-3-3-3-7a7 7 0 0 1 14 0c0 4-3 5-3 7m-8 1h8m-7 3h6m-5 3h4"/>'
};
export function icon(name){return '<svg class="glyph" viewBox="0 0 24 24" aria-hidden="true">'+paths[name]+'</svg>';}
export function fillIcons(root=document){root.querySelectorAll('[data-icon]').forEach(el=>{el.innerHTML=icon(el.dataset.icon);});}
