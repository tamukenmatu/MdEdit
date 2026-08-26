import { marked } from 'marked';
import hljs from 'highlight.js';
import 'highlight.js/styles/tokyo-night-dark.css';
import { MANUAL_DOC } from './manual.js';

// SVG Icons helper (Strict zero-emoji rule)
const ICONS = {
  check: `<svg class="svg-icon" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"></polyline></svg>`,
  info: `<svg class="svg-icon" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>`,
  alert: `<svg class="svg-icon" viewBox="0 0 24 24"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>`,
  error: `<svg class="svg-icon" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>`,
  copy: `<svg class="svg-icon svg-icon-sm" viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>`,
  folder: `<svg class="svg-icon tree-icon" viewBox="0 0 24 24"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>`,
  folderOpen: `<svg class="svg-icon tree-icon" viewBox="0 0 24 24"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path><polyline points="19 19 22 13 8 13 5 19"></polyline></svg>`,
  file: `<svg class="svg-icon tree-icon" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>`,
  image: `<svg class="svg-icon tree-icon" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>`,
  chevron: `<svg class="svg-icon tree-chevron" viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6"></polyline></svg>`
};

const DEFAULT_VAULT_PATH = '/Users/km1/Library/Mobile Documents/iCloud~md~obsidian/Documents/01KEN';

const savedObsidianMode = localStorage.getItem('mdedit_obsidian_mode');
const obsidianMode = savedObsidianMode !== null ? (savedObsidianMode === 'true') : false;
const savedTab = localStorage.getItem('mdedit_active_sidebar_tab');
// Default to 'toc' if obsidianMode is off; if obsidianMode is on, default to 'vault' (or saved tab)
const defaultTab = savedTab ? savedTab : (obsidianMode ? 'vault' : 'toc');

// Application State
const state = {
  filePath: null,
  fileName: 'Untitled.md',
  savedContent: '',
  currentContent: '',
  isDirty: false,
  isManual: false,
  paletteExpanded: false,
  palettePinned: localStorage.getItem('mdedit_palette_pinned') === 'true',
  zoomLevel: parseFloat(localStorage.getItem('mdedit_zoom_level')) || 1.0,
  mode: 'view', // 'view' | 'edit' | 'split'
  sidebarOpen: localStorage.getItem('mdedit_sidebar_open') !== 'false',
  activeSidebarTab: defaultTab, // 'toc' | 'vault'
  obsidianMode: obsidianMode,
  vaultPath: localStorage.getItem('mdedit_vault_path') || DEFAULT_VAULT_PATH,
  vaultTree: [],
  vaultFilesMap: new Map(), // lowercased basename without ext -> full path
  vaultImagesMap: new Map(), // filename -> full path
  tocHeadings: []
};

// Check if running in Tauri environment
const isTauri = typeof window !== 'undefined' && window.__TAURI_INTERNALS__ !== undefined;

let tauriCore = null;
let tauriEvent = null;

async function initTauri() {
  if (isTauri) {
    try {
      tauriCore = await import('@tauri-apps/api/core');
      tauriEvent = await import('@tauri-apps/api/event');
    } catch (e) {
      console.warn('Tauri API import fallback:', e);
    }
  }
}

// DOM Elements
const elements = {
  body: document.body,
  fileName: document.getElementById('file-name'),
  filePath: document.getElementById('file-path'),
  saveStatusDot: document.getElementById('save-status-dot'),
  saveStatusText: document.getElementById('save-status-text'),
  editor: document.getElementById('markdown-editor'),
  preview: document.getElementById('markdown-preview'),
  previewPane: document.getElementById('preview-pane'),
  editorPane: document.getElementById('editor-pane'),
  editorGutter: document.getElementById('editor-gutter'),
  editPalette: document.getElementById('edit-palette'),
  btnTogglePalette: document.getElementById('btn-toggle-palette'),
  appSidebar: document.getElementById('app-sidebar'),
  tabVault: document.getElementById('tab-vault'),
  tabToc: document.getElementById('tab-toc'),
  panelVault: document.getElementById('panel-vault'),
  panelToc: document.getElementById('panel-toc'),
  vaultTitle: document.getElementById('vault-title'),
  vaultFileCount: document.getElementById('vault-file-count'),
  btnChangeVault: document.getElementById('btn-change-vault'),
  btnRefreshVault: document.getElementById('btn-refresh-vault'),
  vaultSearchInput: document.getElementById('vault-search-input'),
  vaultTree: document.getElementById('vault-tree'),
  btnObsidianVault: document.getElementById('btn-obsidian-vault'),
  vaultBtnLabel: document.getElementById('vault-btn-label'),
  tocNav: document.getElementById('toc-nav'),
  tocCount: document.getElementById('toc-count'),
  btnToggleSidebar: document.getElementById('btn-toggle-sidebar'),
  modeView: document.getElementById('mode-view'),
  modeEdit: document.getElementById('mode-edit'),
  modeSplit: document.getElementById('mode-split'),
  statWords: document.getElementById('stat-words'),
  statChars: document.getElementById('stat-chars'),
  statLines: document.getElementById('stat-lines'),
  cursorPos: document.getElementById('footer-cursor-pos'),
  readingTime: document.getElementById('footer-reading-time'),
  btnNew: document.getElementById('btn-new'),
  btnOpen: document.getElementById('btn-open'),
  btnSaveToVault: document.getElementById('btn-save-to-vault'),
  btnSave: document.getElementById('btn-save'),
  btnReload: document.getElementById('btn-reload'),
  btnBrand: document.getElementById('btn-brand'),
  btnMore: document.getElementById('btn-more'),
  moreMenu: document.getElementById('more-menu'),
  menuDownloadManual: document.getElementById('menu-download-manual'),
  menuPinPalette: document.getElementById('menu-pin-palette'),
  menuPinPaletteLabel: document.getElementById('menu-pin-palette-label'),
  menuZoomIn: document.getElementById('menu-zoom-in'),
  menuZoomOut: document.getElementById('menu-zoom-out'),
  menuZoomReset: document.getElementById('menu-zoom-reset'),
  menuZoomResetLabel: document.getElementById('menu-zoom-reset-label'),
  menuResetPaletteOrder: document.getElementById('menu-reset-palette-order'),
  menuSaveAs: document.getElementById('menu-save-as'),
  menuCopyMd: document.getElementById('menu-copy-md'),
  menuCopyHtml: document.getElementById('menu-copy-html'),
  menuExportHtml: document.getElementById('menu-export-html'),
  menuPrintPdf: document.getElementById('menu-print-pdf'),
  menuCheckUpdate: document.getElementById('menu-check-update'),
  menuShowFinder: document.getElementById('menu-show-finder'),
  updateBadgeDot: document.getElementById('update-badge-dot'),
  searchContainer: document.getElementById('search-container'),
  btnSearchToggle: document.getElementById('btn-search-toggle'),
  btnSearchClear: document.getElementById('btn-search-clear'),
  searchInput: document.getElementById('search-input'),
  searchCount: document.getElementById('search-count'),
  btnSearchPrev: document.getElementById('btn-search-prev'),
  btnSearchNext: document.getElementById('btn-search-next'),
  toastContainer: document.getElementById('toast-container')
};

// Toast Notifications
function showToast(message, type = 'info', duration = 3000) {
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  
  let iconSvg = ICONS.info;
  if (type === 'success') iconSvg = ICONS.check;
  if (type === 'error') iconSvg = ICONS.error;
  if (type === 'warning') iconSvg = ICONS.alert;

  toast.innerHTML = `
    ${iconSvg}
    <span>${message}</span>
  `;

  elements.toastContainer.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px) scale(0.95)';
    setTimeout(() => toast.remove(), 200);
  }, duration);
}

// Markdown Renderer Configuration
const renderer = new marked.Renderer();

// Custom heading with id generation for TOC
renderer.heading = function({ tokens, depth, text }) {
  const cleanId = text.toLowerCase()
    .replace(/[^\w\u4e00-\u9fa5\u3040-\u309f\u30a0-\u30ff-]+/g, '-')
    .replace(/^-+|-+$/g, '');
  const id = cleanId || `heading-${Math.random().toString(36).substring(2, 8)}`;
  return `<h${depth} id="${id}">${text}</h${depth}>`;
};

// Custom code block with syntax highlight & copy button
renderer.code = function({ text, lang }) {
  const validLang = lang && hljs.getLanguage(lang) ? lang : '';
  let highlighted = '';
  if (validLang) {
    try {
      highlighted = hljs.highlight(text, { language: validLang, ignoreIllegals: true }).value;
    } catch (e) {
      highlighted = hljs.highlightAuto(text).value;
    }
  } else {
    try {
      highlighted = hljs.highlightAuto(text).value;
    } catch (e) {
      highlighted = text;
    }
  }

  const langDisplay = validLang ? validLang : 'text';

  return `
    <pre>
      <div class="code-block-header">
        <span class="code-lang-label">${langDisplay}</span>
        <button class="btn-code-copy" data-code="${encodeURIComponent(text)}" title="コードをコピー">
          ${ICONS.copy}
          <span>コピー</span>
        </button>
      </div>
      <code>${highlighted}</code>
    </pre>
  `;
};

// Custom checkbox renderer for interactive task lists
renderer.checkbox = function({ checked }) {
  return `<input type="checkbox" class="task-list-checkbox" ${checked ? 'checked' : ''} /> `;
};

marked.setOptions({
  renderer: renderer,
  gfm: true,
  breaks: true
});

// Frontmatter YAML Parser
function parseFrontmatter(markdown) {
  const match = markdown.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!match) return { frontmatter: null, content: markdown };

  const rawYaml = match[1];
  const remainingContent = markdown.substring(match[0].length);
  const data = {};

  const lines = rawYaml.split('\n');
  let currentKey = null;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    if (trimmed.startsWith('- ') && currentKey && Array.isArray(data[currentKey])) {
      data[currentKey].push(trimmed.substring(2).trim());
      continue;
    }

    const colonIdx = line.indexOf(':');
    if (colonIdx > 0) {
      const key = line.substring(0, colonIdx).trim();
      let val = line.substring(colonIdx + 1).trim();

      if (val.startsWith('[') && val.endsWith(']')) {
        data[key] = val.slice(1, -1).split(',').map(s => s.trim().replace(/^["']|["']$/g, '')).filter(Boolean);
        currentKey = null;
      } else if (!val) {
        data[key] = [];
        currentKey = key;
      } else {
        data[key] = val.replace(/^["']|["']$/g, '');
        currentKey = null;
      }
    }
  }

  return { frontmatter: Object.keys(data).length > 0 ? data : null, content: remainingContent };
}

// Render Frontmatter Card HTML
function renderFrontmatterCard(fm) {
  if (!fm) return '';
  let fieldsHtml = '';

  for (const [key, val] of Object.entries(fm)) {
    if (key.toLowerCase() === 'tags' || key.toLowerCase() === 'tag') {
      const tags = Array.isArray(val) ? val : [val];
      const tagsPills = tags.map(t => `<span class="frontmatter-tag">#${t.replace(/^#/, '')}</span>`).join(' ');
      fieldsHtml += `
        <div class="frontmatter-row">
          <span class="frontmatter-key">タグ</span>
          <div class="frontmatter-tag-list">${tagsPills}</div>
        </div>
      `;
    } else {
      const displayVal = Array.isArray(val) ? val.join(', ') : val;
      fieldsHtml += `
        <div class="frontmatter-row">
          <span class="frontmatter-key">${key}</span>
          <span class="frontmatter-val">${displayVal}</span>
        </div>
      `;
    }
  }

  return `
    <div class="frontmatter-card">
      <div class="frontmatter-header">
        <svg class="svg-icon svg-icon-sm svg-icon-accent" viewBox="0 0 24 24">
          <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"></path>
          <line x1="7" y1="7" x2="7.01" y2="7"></line>
        </svg>
        <span>プロパティ (Frontmatter)</span>
      </div>
      <div class="frontmatter-grid">
        ${fieldsHtml}
      </div>
    </div>
  `;
}

const IMAGE_EXTS = ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'bmp', 'avif'];
const AUDIO_EXTS = ['mp3', 'wav', 'm4a', 'ogg', 'aac'];
const VIDEO_EXTS = ['mp4', 'webm', 'mov'];

// WikiLinks Preprocessor (Safely protects code blocks and inline backticks from being converted)
function processWikiLinks(text) {
  const codePlaceholders = [];

  // Protect code blocks and inline code
  // 1. Fenced code blocks ```...```
  text = text.replace(/```[\s\S]*?```/g, (match) => {
    const idx = codePlaceholders.length;
    codePlaceholders.push(match);
    return `@@CODE_PLACEHOLDER_${idx}@@`;
  });

  // 2. Inline code spans `...`
  text = text.replace(/`[^`\n]+`/g, (match) => {
    const idx = codePlaceholders.length;
    codePlaceholders.push(match);
    return `@@CODE_PLACEHOLDER_${idx}@@`;
  });

  // Convert ![[filename|options]] or ![[filename]]
  text = text.replace(/!\[\[(.*?)\]\]/g, (match, p1) => {
    const parts = p1.split('|');
    const filename = parts[0].trim();
    const altOrWidth = parts[1] ? parts[1].trim() : filename;
    const dotIdx = filename.lastIndexOf('.');
    const ext = dotIdx >= 0 ? filename.substring(dotIdx + 1).toLowerCase() : '';

    if (IMAGE_EXTS.includes(ext)) {
      return `![${altOrWidth}](${filename})`;
    } else if (AUDIO_EXTS.includes(ext)) {
      return `<div class="media-embed-card"><audio controls src="${filename}"></audio><span class="media-label">${filename}</span></div>`;
    } else if (VIDEO_EXTS.includes(ext)) {
      return `<div class="media-embed-card"><video controls src="${filename}"></video></div>`;
    } else {
      // Document / Sheet music / Archive / Binary file attachment badge (Single-line to prevent markdown code-block conversion)
      const tagLabel = ext ? ext.toUpperCase() : 'FILE';
      return `<div class="embedded-file-badge" data-file="${encodeURIComponent(filename)}" title="ファイル: ${filename}"><svg class="svg-icon svg-icon-sm" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line></svg><span class="file-embed-title">${filename}</span><span class="file-embed-tag">${tagLabel}</span></div>`;
    }
  });

  // Convert [[target|label]] or [[target]] to custom wikilinks
  text = text.replace(/\[\[(.*?)\]\]/g, (match, p1) => {
    const parts = p1.split('|');
    const target = parts[0].trim();
    const label = parts[1] ? parts[1].trim() : target;
    return `<a class="wikilink" href="#" data-wikilink="${encodeURIComponent(target)}">${label}</a>`;
  });

  // Restore protected code spans
  text = text.replace(/@@CODE_PLACEHOLDER_(\d+)@@/g, (match, p1) => {
    const idx = parseInt(p1, 10);
    return codePlaceholders[idx] !== undefined ? codePlaceholders[idx] : match;
  });

  return text;
}

// Update Document Stats
function updateStats(content) {
  const lines = content.length === 0 ? 1 : content.split('\n').length;
  const chars = content.length;
  const cjkChars = (content.match(/[\u4e00-\u9fa5\u3040-\u309f\u30a0-\u30ff]/g) || []).length;
  const nonCjkWords = (content.replace(/[\u4e00-\u9fa5\u3040-\u309f\u30a0-\u30ff]/g, ' ')
    .trim().match(/\S+/g) || []).length;
  const words = cjkChars + nonCjkWords;

  elements.statLines.textContent = `${lines} 行`;
  elements.statChars.textContent = `${chars.toLocaleString()} 文字`;
  elements.statWords.textContent = `${words.toLocaleString()} 単語`;
}

// Update Line Numbers Gutter
function updateGutter(lineCount) {
  let gutterHtml = '';
  for (let i = 1; i <= Math.max(1, lineCount); i++) {
    gutterHtml += `<div class="line-number">${i}</div>`;
  }
  elements.editorGutter.innerHTML = gutterHtml;
}

// Extract and Render Table of Contents
function updateTOC() {
  const headings = elements.preview.querySelectorAll('h1, h2, h3, h4');
  state.tocHeadings = [];

  if (headings.length === 0) {
    elements.tocNav.innerHTML = '<div class="toc-empty">見出しがありません</div>';
    elements.tocCount.textContent = '0 項目';
    return;
  }

  let tocHtml = '';
  headings.forEach((h, index) => {
    const level = parseInt(h.tagName.substring(1), 10);
    const text = h.textContent.replace(/^#+\s*/, '').trim();
    const id = h.id || `heading-${index}`;
    h.id = id;

    state.tocHeadings.push({ id, level, text, element: h });

    tocHtml += `
      <a href="#${id}" class="toc-item level-${level}" data-target="${id}">
        ${text}
      </a>
    `;
  });

  elements.tocNav.innerHTML = tocHtml;
  elements.tocCount.textContent = `${headings.length} 項目`;

  // Smooth scroll click handler
  elements.tocNav.querySelectorAll('.toc-item').forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      const targetId = item.getAttribute('data-target');
      const targetEl = document.getElementById(targetId);
      if (targetEl) {
        targetEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
        setActiveTOC(targetId);
      }
    });
  });
}

function setActiveTOC(id) {
  elements.tocNav.querySelectorAll('.toc-item').forEach(item => {
    if (item.getAttribute('data-target') === id) {
      item.classList.add('active');
    } else {
      item.classList.remove('active');
    }
  });
}

// Resolve Local Images in Markdown Preview
async function resolveLocalImages() {
  const images = elements.preview.querySelectorAll('img');
  for (const img of images) {
    img.onerror = () => {
      img.style.display = 'none';
    };

    if (!isTauri || !tauriCore) continue;

    const src = img.getAttribute('src');
    if (!src || src.startsWith('http://') || src.startsWith('https://') || src.startsWith('data:')) {
      continue;
    }

    const cleanFilename = decodeURIComponent(src).split('/').pop();
    let targetPath = state.vaultImagesMap.get(cleanFilename);

    if (!targetPath && state.filePath) {
      const currentDir = state.filePath.substring(0, state.filePath.lastIndexOf('/'));
      targetPath = `${currentDir}/${cleanFilename}`;
    }

    if (targetPath) {
      try {
        const dataUrl = await tauriCore.invoke('read_file_as_data_url', { filePath: targetPath });
        img.src = dataUrl;
      } catch (e) {
        img.style.display = 'none';
      }
    } else {
      img.style.display = 'none';
    }
  }
}

// Open WikiLink Target
async function openWikiLinkTarget(targetName) {
  const cleanTarget = targetName.replace(/\.md$/i, '').toLowerCase().trim();
  const filePath = state.vaultFilesMap.get(cleanTarget);

  if (filePath) {
    if (isTauri && tauriCore) {
      try {
        const payload = await tauriCore.invoke('read_file', { path: filePath });
        loadFilePayload(payload);
        highlightActiveTreeFile(filePath);
        showToast(`「${payload.name}」を開きました`, 'info');
      } catch (e) {
        showToast(`開けませんでした: ${e}`, 'error');
      }
    }
  } else {
    showToast(`「${targetName}」は保管庫内に見つかりませんでした`, 'warning');
  }
}

// Render Markdown
function renderMarkdown() {
  const rawContent = elements.editor.value;
  state.currentContent = rawContent;
  
  // Parse YAML frontmatter
  const { frontmatter, content: cleanMarkdown } = parseFrontmatter(rawContent);
  const wikiProcessed = processWikiLinks(cleanMarkdown);
  const renderedHtml = marked.parse(wikiProcessed);
  const frontmatterHtml = renderFrontmatterCard(frontmatter);

  elements.preview.innerHTML = frontmatterHtml + renderedHtml;
  
  // Attach copy button handlers
  elements.preview.querySelectorAll('.btn-code-copy').forEach(btn => {
    btn.addEventListener('click', async () => {
      const code = decodeURIComponent(btn.getAttribute('data-code'));
      await navigator.clipboard.writeText(code);
      const span = btn.querySelector('span');
      const oldText = span.textContent;
      span.textContent = 'コピー完了';
      setTimeout(() => { span.textContent = oldText; }, 1500);
      showToast('コードをクリップボードにコピーしました', 'success');
    });
  });

  // Attach WikiLink click handlers
  elements.preview.querySelectorAll('.wikilink').forEach(link => {
    link.addEventListener('click', async (e) => {
      e.preventDefault();
      const targetName = decodeURIComponent(link.getAttribute('data-wikilink'));
      await openWikiLinkTarget(targetName);
    });
  });

  // Attach embedded file badge click handlers
  elements.preview.querySelectorAll('.embedded-file-badge').forEach(badge => {
    badge.addEventListener('click', async () => {
      const fileName = decodeURIComponent(badge.getAttribute('data-file'));
      let filePath = state.vaultImagesMap.get(fileName);
      if (!filePath && state.filePath) {
        const currentDir = state.filePath.substring(0, state.filePath.lastIndexOf('/'));
        filePath = `${currentDir}/${fileName}`;
      }
      if (filePath && isTauri && tauriCore) {
        try {
          await tauriCore.invoke('show_in_finder', { path: filePath });
          showToast(`Finder で「${fileName}」を表示しました`, 'info');
        } catch (e) {
          showToast(`添付ファイル: ${fileName}`, 'info');
        }
      } else {
        showToast(`添付ファイル: ${fileName}`, 'info');
      }
    });
  });

  // Attach checkbox change handlers for interactive task lists in preview
  elements.preview.querySelectorAll('.task-list-checkbox').forEach((cb, idx) => {
    cb.addEventListener('change', () => {
      toggleTaskCheckbox(idx, cb.checked);
    });
  });

  // Resolve local vault images
  resolveLocalImages();

  updateTOC();
  updateStats(rawContent);
  
  const lines = rawContent.length === 0 ? 1 : rawContent.split('\n').length;
  updateGutter(lines);

  // Check dirty state
  setDirty(state.currentContent !== state.savedContent);

  // Re-apply search highlights if search is open
  if (typeof searchState !== 'undefined' && searchState.isOpen && searchState.query) {
    performSearch(searchState.query);
  }
}

// Dirty status indicator
function setDirty(isDirty) {
  state.isDirty = isDirty;
  if (isDirty) {
    elements.saveStatusDot.className = 'save-status-dot unsaved';
    elements.saveStatusDot.title = '未保存の変更があります';
    elements.saveStatusText.textContent = '未保存';
  } else {
    elements.saveStatusDot.className = 'save-status-dot saved';
    elements.saveStatusDot.title = '保存済み';
    elements.saveStatusText.textContent = '保存済み';
  }
}

// Mode Switching
function setMode(mode) {
  state.mode = mode;
  elements.body.classList.remove('mode-view', 'mode-edit', 'mode-split');
  elements.body.classList.add(`mode-${mode}`);

  elements.modeView.classList.toggle('active', mode === 'view');
  elements.modeEdit.classList.toggle('active', mode === 'edit');
  elements.modeSplit.classList.toggle('active', mode === 'split');

  if (typeof searchState !== 'undefined' && searchState.isOpen && searchState.query) {
    performSearch(searchState.query);
  }

  if (mode === 'edit' || mode === 'split') {
    elements.editor.focus();
  }
}

// Sidebar Tab Switching (Vault ⇄ TOC)
function switchSidebarTab(tab) {
  state.activeSidebarTab = tab;
  localStorage.setItem('mdedit_active_sidebar_tab', tab);

  elements.tabVault.classList.toggle('active', tab === 'vault');
  elements.tabToc.classList.toggle('active', tab === 'toc');
  elements.panelVault.classList.toggle('active', tab === 'vault');
  elements.panelToc.classList.toggle('active', tab === 'toc');

  // Ensure sidebar is open
  if (!state.sidebarOpen) {
    toggleSidebar();
  }
}

// Sync Obsidian Mode UI Indicator
function syncObsidianModeUI() {
  elements.btnObsidianVault.classList.toggle('active', state.obsidianMode);
  const indicator = document.getElementById('vault-switch-indicator');
  if (indicator) {
    indicator.textContent = state.obsidianMode ? 'ON' : 'OFF';
  }
}

// Toggle Obsidian Vault Mode (ON / OFF switch)
function toggleObsidianMode() {
  state.obsidianMode = !state.obsidianMode;
  localStorage.setItem('mdedit_obsidian_mode', state.obsidianMode);

  if (state.obsidianMode) {
    switchSidebarTab('vault');
    showToast('Obsidian モード: ON (書庫リスト)', 'info', 1800);
  } else {
    switchSidebarTab('toc');
    showToast('Obsidian モード: OFF (目次)', 'info', 1800);
  }
  syncObsidianModeUI();
}

// Vault Explorer Tree Builder
function buildVaultIndex(nodes) {
  state.vaultFilesMap.clear();
  state.vaultImagesMap.clear();
  let totalFiles = 0;

  function traverse(list) {
    for (const item of list) {
      if (item.is_dir && item.children) {
        traverse(item.children);
      } else {
        const ext = item.name.split('.').pop().toLowerCase();
        if (ext === 'md' || ext === 'markdown' || ext === 'txt') {
          const baseName = item.name.replace(/\.(md|markdown|txt)$/i, '').toLowerCase();
          state.vaultFilesMap.set(baseName, item.path);
          totalFiles++;
        } else if (['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp'].includes(ext)) {
          state.vaultImagesMap.set(item.name, item.path);
        }
      }
    }
  }

  traverse(nodes);
  elements.vaultFileCount.textContent = `${totalFiles} ファイル`;
}

function renderVaultNode(item, searchQuery = '') {
  const isMatch = searchQuery === '' || item.name.toLowerCase().includes(searchQuery.toLowerCase());

  if (item.is_dir) {
    let childrenHtml = '';
    let hasMatchingChild = false;

    if (item.children) {
      for (const child of item.children) {
        const childRes = renderVaultNode(child, searchQuery);
        if (childRes.html) {
          childrenHtml += childRes.html;
          if (childRes.matched) hasMatchingChild = true;
        }
      }
    }

    if (searchQuery !== '' && !isMatch && !hasMatchingChild) {
      return { html: '', matched: false };
    }

    const isOpen = searchQuery !== '' && hasMatchingChild;

    const html = `
      <div class="tree-node tree-folder" data-path="${item.path}">
        <div class="tree-row folder-row">
          <span class="tree-chevron ${isOpen ? 'open' : ''}">${ICONS.chevron}</span>
          ${ICONS.folder}
          <span class="tree-label">${item.name}</span>
        </div>
        <div class="tree-children ${isOpen ? 'open' : ''}">
          ${childrenHtml}
        </div>
      </div>
    `;

    return { html, matched: isMatch || hasMatchingChild };
  } else {
    if (searchQuery !== '' && !isMatch) {
      return { html: '', matched: false };
    }

    const ext = item.name.split('.').pop().toLowerCase();
    const isImage = ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp'].includes(ext);
    const iconSvg = isImage ? ICONS.image : ICONS.file;
    const isActive = state.filePath === item.path;

    const html = `
      <div class="tree-node tree-file" data-path="${item.path}" data-name="${item.name}">
        <div class="tree-row file-row ${isActive ? 'active' : ''}">
          <span style="width: 12px; display: inline-block;"></span>
          ${iconSvg}
          <span class="tree-label">${item.name}</span>
        </div>
      </div>
    `;

    return { html, matched: isMatch };
  }
}

function renderVaultTree(searchQuery = '') {
  if (state.vaultTree.length === 0) {
    elements.vaultTree.innerHTML = '<div class="vault-loading">保管庫内にファイルがありません</div>';
    return;
  }

  let fullHtml = '';
  for (const item of state.vaultTree) {
    const res = renderVaultNode(item, searchQuery);
    if (res.html) fullHtml += res.html;
  }

  if (!fullHtml) {
    elements.vaultTree.innerHTML = '<div class="vault-loading">一致するファイルが見つかりません</div>';
    return;
  }

  elements.vaultTree.innerHTML = fullHtml;

  // Folder toggle listeners
  elements.vaultTree.querySelectorAll('.folder-row').forEach(row => {
    row.addEventListener('click', (e) => {
      e.stopPropagation();
      const node = row.closest('.tree-folder');
      const chevron = row.querySelector('.tree-chevron');
      const children = node.querySelector('.tree-children');
      chevron.classList.toggle('open');
      children.classList.toggle('open');
    });
  });

  // File click listeners
  elements.vaultTree.querySelectorAll('.file-row').forEach(row => {
    row.addEventListener('click', async (e) => {
      e.stopPropagation();
      const node = row.closest('.tree-file');
      const path = node.getAttribute('data-path');
      const name = node.getAttribute('data-name');
      const ext = (name || '').split('.').pop().toLowerCase();
      const textExtensions = ['md', 'markdown', 'mdown', 'mkd', 'mkdn', 'txt', 'csv', 'tsv', 'log', 'py', 'js', 'ts', 'json', 'yml', 'yaml', 'sh', 'zsh', 'bash', 'css', 'html', 'toml', 'conf', 'ini', 'env', 'sql', 'rs', 'rb', 'go', 'c', 'cpp', 'h'];
      if (textExtensions.includes(ext)) {
        if (isTauri && tauriCore) {
          try {
            const payload = await tauriCore.invoke('read_file', { path });
            loadFilePayload(payload);
            highlightActiveTreeFile(path);
          } catch (err) {
            showToast(`ファイルを開けませんでした: ${err}`, 'error');
          }
        }
      } else {
        showToast(`画像・バイナリファイルです: ${name}`, 'info');
      }
    });
  });
}

function highlightActiveTreeFile(path) {
  elements.vaultTree.querySelectorAll('.file-row').forEach(row => {
    const node = row.closest('.tree-file');
    if (node && node.getAttribute('data-path') === path) {
      row.classList.add('active');
    } else {
      row.classList.remove('active');
    }
  });
}

// Load Vault Directory Tree
async function loadVaultTree() {
  const vaultName = state.vaultPath.split('/').filter(Boolean).pop() || 'Vault';
  elements.vaultTitle.textContent = vaultName;
  elements.vaultBtnLabel.textContent = vaultName;

  if (isTauri && tauriCore) {
    try {
      const tree = await tauriCore.invoke('read_vault_tree', { vaultPath: state.vaultPath });
      state.vaultTree = tree;
      buildVaultIndex(tree);
      renderVaultTree(elements.vaultSearchInput.value.trim());
    } catch (e) {
      elements.vaultTree.innerHTML = `<div class="vault-loading">保管庫の読み込みに失敗しました</div>`;
      console.warn('Vault load error:', e);
    }
  } else {
    elements.vaultTree.innerHTML = `<div class="vault-loading">Web モード（Tauri 未接続）</div>`;
  }
}

// Change Vault Folder Dialog
async function changeVaultFolder() {
  if (isTauri && tauriCore) {
    try {
      const newPath = await tauriCore.invoke('open_folder_dialog');
      if (newPath) {
        state.vaultPath = newPath;
        localStorage.setItem('mdedit_vault_path', newPath);
        await loadVaultTree();
        showToast(`保管庫を変更しました: ${newPath.split('/').pop()}`, 'success');
      }
    } catch (e) {
      showToast(`フォルダ選択エラー: ${e}`, 'error');
    }
  }
}

// File Operations
function loadFilePayload(payload, isManual = false) {
  state.filePath = payload.path;
  state.fileName = payload.name;
  state.savedContent = payload.content;
  state.currentContent = payload.content;
  state.isManual = isManual || payload.name === 'MdEdit_Manual.md';

  elements.fileName.textContent = payload.name;
  elements.filePath.textContent = payload.path || (state.isManual ? 'システムマニュアル' : '新規ドキュメント');
  elements.filePath.title = payload.path || elements.filePath.textContent;
  document.title = `${payload.name} - MdEdit`;

  // Toggle manual download button visibility
  if (elements.btnDownloadManual) {
    elements.btnDownloadManual.style.display = state.isManual ? 'inline-flex' : 'none';
  }

  elements.editor.value = payload.content;
  setDirty(false);
  renderMarkdown();
  highlightActiveTreeFile(payload.path);

  // Determine initial mode based on file extension
  // Non-markdown plain text files (e.g. .txt, .csv, .py, .js, .json, .log, etc.) open directly in Edit mode
  const ext = (payload.name || '').split('.').pop().toLowerCase();
  const isMarkdown = ['md', 'markdown', 'mdown', 'mkd', 'mkdn'].includes(ext);

  if (!isMarkdown && ext && !isManual) {
    setMode('edit');
  } else if (!isManual && state.mode !== 'edit' && state.mode !== 'split') {
    setMode('view');
  }
}

function showWelcomeManual() {
  loadFilePayload({
    path: '',
    name: 'Welcome.md',
    content: MANUAL_DOC,
    size: MANUAL_DOC.length,
    last_modified: Date.now()
  }, true);
  setMode('view');
  showToast('ようこそ画面（マニュアル）を表示しました', 'info');
}

async function downloadManual() {
  const content = MANUAL_DOC;
  const fileName = 'MdEdit_Manual.md';

  if (isTauri && tauriCore) {
    try {
      const payload = await tauriCore.invoke('save_file_as_dialog', {
        defaultName: fileName,
        content: content
      });
      if (payload) {
        showToast(`マニュアルを保存しました: ${payload.name}`, 'success');
      }
    } catch (e) {
      showToast(`マニュアル保存エラー: ${e}`, 'error');
    }
  } else {
    const blob = new Blob([content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
    showToast('マニュアル（MdEdit_Manual.md）をダウンロードしました', 'success');
  }
}

async function openFile() {
  if (isTauri && tauriCore) {
    try {
      const payload = await tauriCore.invoke('open_file_dialog');
      if (payload) {
        loadFilePayload(payload);
      }
    } catch (e) {
      showToast(`ファイル読み込みエラー: ${e}`, 'error');
    }
  } else {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.md,.markdown,.txt';
    input.onchange = (e) => {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
          loadFilePayload({
            path: file.name,
            name: file.name,
            content: event.target.result,
            size: file.size,
            last_modified: Date.now()
          });
        };
        reader.readAsText(file);
      }
    };
    input.click();
  }
}

async function saveToObsidianVault() {
  const content = elements.editor.value;
  let fileName = state.fileName;

  if (!fileName || fileName === 'Untitled.md') {
    const userTitle = prompt('Obsidian 保管庫に保存するファイル名を入力してください:', '新規ノート.md');
    if (!userTitle) return;
    fileName = userTitle.endsWith('.md') || userTitle.endsWith('.markdown') || userTitle.endsWith('.txt') ? userTitle : `${userTitle}.md`;
  }

  if (isTauri && tauriCore) {
    try {
      const payload = await tauriCore.invoke('move_to_vault', {
        currentPath: state.filePath,
        vaultPath: state.vaultPath,
        fileName: fileName,
        content: content
      });

      loadFilePayload(payload);
      switchSidebarTab('vault');
      await loadVaultTree();
      highlightActiveTreeFile(payload.path);
      showToast(`「${payload.name}」を Obsidian 保管庫へ保存・移動しました`, 'success');
    } catch (e) {
      showToast(`保管庫への保存・移動エラー: ${e}`, 'error');
    }
  } else {
    showToast('Web モードでは保管庫への保存・移動はシミュレーションです', 'info');
  }
}

async function saveFile() {
  const content = elements.editor.value;
  if (!state.filePath) {
    await saveFileAs();
    return;
  }

  if (isTauri && tauriCore) {
    try {
      const payload = await tauriCore.invoke('save_file', {
        path: state.filePath,
        content: content
      });
      state.savedContent = content;
      setDirty(false);
      showToast(`「${state.fileName}」を保存しました`, 'success');
      loadVaultTree();
    } catch (e) {
      showToast(`保存エラー: ${e}`, 'error');
    }
  } else {
    state.savedContent = content;
    setDirty(false);
    showToast('保存しました (Web モード)', 'success');
  }
}

async function saveFileAs() {
  const content = elements.editor.value;
  if (isTauri && tauriCore) {
    try {
      const payload = await tauriCore.invoke('save_file_as_dialog', {
        defaultName: state.fileName,
        content: content
      });
      if (payload) {
        loadFilePayload(payload);
        showToast(`「${payload.name}」として保存しました`, 'success');
        loadVaultTree();
      }
    } catch (e) {
      showToast(`保存エラー: ${e}`, 'error');
    }
  } else {
    const blob = new Blob([content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = state.fileName || 'document.md';
    a.click();
    URL.revokeObjectURL(url);
    state.savedContent = content;
    setDirty(false);
    showToast('ファイルをダウンロードしました', 'success');
  }
}

async function reloadFile() {
  if (!state.filePath) {
    showToast('未保存の新規ドキュメントです', 'info');
    return;
  }
  if (state.isDirty) {
    const confirmReload = confirm('未保存の変更が破棄されます。再読み込みしますか？');
    if (!confirmReload) return;
  }

  if (isTauri && tauriCore) {
    try {
      const payload = await tauriCore.invoke('read_file', { path: state.filePath });
      loadFilePayload(payload);
      showToast('ファイルを再読み込みしました', 'info');
    } catch (e) {
      showToast(`再読み込みエラー: ${e}`, 'error');
    }
  }
}

function newFile() {
  if (state.isDirty) {
    const confirmNew = confirm('未保存の変更があります。新規ドキュメントを作成しますか？');
    if (!confirmNew) return;
  }

  loadFilePayload({
    path: '',
    name: 'Untitled.md',
    content: `# 新規ドキュメント\n\nここに Markdown を記述します。\n`,
    size: 0,
    last_modified: Date.now()
  });
  setMode('edit');
}

async function showInFinder() {
  if (!state.filePath) {
    showToast('ファイルが保存されていません', 'info');
    return;
  }
  if (isTauri && tauriCore) {
    try {
      await tauriCore.invoke('show_in_finder', { path: state.filePath });
    } catch (e) {
      showToast(`Finder表示エラー: ${e}`, 'error');
    }
  }
}

async function copyMarkdown() {
  const content = elements.editor.value;
  await navigator.clipboard.writeText(content);
  showToast('Markdown テキストをコピーしました', 'success');
}

async function copyHtml() {
  const html = elements.preview.innerHTML;
  await navigator.clipboard.writeText(html);
  showToast('レンダリング済み HTML をコピーしました', 'success');
}

async function exportHtmlFile() {
  const defaultName = state.fileName.replace(/\.md$/i, '') + '.html';
  const fullHtml = `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <title>${state.fileName}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 880px; margin: 40px auto; padding: 0 20px; line-height: 1.6; color: #1e293b; }
    pre { background: #f8fafc; border: 1px solid #e2e8f0; padding: 12px; border-radius: 6px; overflow-x: auto; }
    code { font-family: monospace; }
    table { width: 100%; border-collapse: collapse; margin: 20px 0; }
    th, td { border: 1px solid #cbd5e1; padding: 8px 12px; text-align: left; }
    th { background: #f1f5f9; }
    blockquote { border-left: 4px solid #38bdf8; margin: 16px 0; padding: 8px 16px; background: #f0f9ff; color: #475569; }
  </style>
</head>
<body>
${elements.preview.innerHTML}
</body>
</html>`;

  if (isTauri && tauriCore) {
    try {
      const path = await tauriCore.invoke('export_html_file_dialog', {
        defaultName: defaultName,
        htmlContent: fullHtml
      });
      if (path) {
        showToast('HTML ファイルを書き出しました', 'success');
      }
    } catch (e) {
      showToast(`エクスポートエラー: ${e}`, 'error');
    }
  } else {
    const blob = new Blob([fullHtml], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = defaultName;
    a.click();
    URL.revokeObjectURL(url);
    showToast('HTML ファイルをダウンロードしました', 'success');
  }
}

// Scroll Synchronization in Split Mode
let isSyncingEditor = false;
let isSyncingPreview = false;

elements.editor.addEventListener('scroll', () => {
  if (state.mode !== 'split' || isSyncingEditor) return;
  isSyncingPreview = true;
  const percentage = elements.editor.scrollTop / (elements.editor.scrollHeight - elements.editor.clientHeight);
  elements.previewPane.scrollTop = percentage * (elements.previewPane.scrollHeight - elements.previewPane.clientHeight);
  setTimeout(() => { isSyncingPreview = false; }, 50);
});

elements.previewPane.addEventListener('scroll', () => {
  // Update active TOC item based on scroll position
  const scrollPos = elements.previewPane.scrollTop + 60;
  for (let i = state.tocHeadings.length - 1; i >= 0; i--) {
    const heading = state.tocHeadings[i];
    if (heading.element.offsetTop <= scrollPos) {
      setActiveTOC(heading.id);
      break;
    }
  }

  if (state.mode !== 'split' || isSyncingPreview) return;
  isSyncingEditor = true;
  const percentage = elements.previewPane.scrollTop / (elements.previewPane.scrollHeight - elements.previewPane.clientHeight);
  elements.editor.scrollTop = percentage * (elements.editor.scrollHeight - elements.editor.clientHeight);
  setTimeout(() => { isSyncingEditor = false; }, 50);
});

// Double Click Preview to Enter Edit Mode (.md files)
elements.previewPane.addEventListener('dblclick', (e) => {
  // Prevent if double clicked on a button, link, or badge
  if (e.target.closest('button') || e.target.closest('a') || e.target.closest('.wikilink') || e.target.closest('.embedded-file-badge') || e.target.closest('.btn-code-copy')) {
    return;
  }

  if (state.mode === 'view') {
    setMode('edit');
    showToast('編集モードに切り替えました', 'info', 1500);
  }
});

// Interactive Task List Checkbox Toggle
function toggleTaskCheckbox(taskIndex, isChecked) {
  const text = elements.editor.value;
  // Match task list markdown patterns (- [ ], * [ ], + [ ], 1. [ ], etc.)
  const regex = /^(\s*[-*+]|\s*\d+\.)\s+\[([ xX])\]/gm;
  let match;
  let currentIndex = 0;

  while ((match = regex.exec(text)) !== null) {
    if (currentIndex === taskIndex) {
      const matchStart = match.index;
      const bracketOpenPos = text.indexOf('[', matchStart);
      if (bracketOpenPos !== -1) {
        const checkPos = bracketOpenPos + 1;
        const newChar = isChecked ? 'x' : ' ';
        const newText = text.substring(0, checkPos) + newChar + text.substring(checkPos + 1);
        elements.editor.value = newText;
        renderMarkdown();
        showToast(isChecked ? 'タスクを完了にしました' : 'タスクを未完了に戻しました', 'info', 1200);
      }
      break;
    }
    currentIndex++;
  }
}

// Editor Key Handling (Tab, auto brackets, smart list continuation)
elements.editor.addEventListener('keydown', (e) => {
  if (e.key === 'Tab') {
    e.preventDefault();
    const start = elements.editor.selectionStart;
    const end = elements.editor.selectionEnd;
    elements.editor.value = elements.editor.value.substring(0, start) + '  ' + elements.editor.value.substring(end);
    elements.editor.selectionStart = elements.editor.selectionEnd = start + 2;
    renderMarkdown();
    return;
  }

  // 1. Smart List Continuation on Enter
  if (e.key === 'Enter' && !e.shiftKey && !e.metaKey && !e.ctrlKey && !e.altKey && !e.isComposing) {
    const val = elements.editor.value;
    const start = elements.editor.selectionStart;
    const end = elements.editor.selectionEnd;

    // Only apply when no selection
    if (start === end) {
      const lineStart = val.lastIndexOf('\n', start - 1) + 1;
      const currentLine = val.substring(lineStart, start);

      // Check task list (- [ ] or - [x] or * [ ] etc.)
      const taskMatch = currentLine.match(/^(\s*[-*+]\s+\[[ xX]\]\s+)(.*)$/);
      if (taskMatch) {
        const prefix = taskMatch[1];
        const content = taskMatch[2];

        e.preventDefault();
        if (content.trim() === '') {
          // Empty task line -> clear the list prefix
          elements.editor.value = val.substring(0, lineStart) + val.substring(start);
          elements.editor.selectionStart = elements.editor.selectionEnd = lineStart;
        } else {
          // Continue task list with unchecked box
          const indent = prefix.match(/^\s*/)[0];
          const listBullet = prefix.trim().startsWith('*') ? '*' : '-';
          const nextPrefix = `\n${indent}${listBullet} [ ] `;
          elements.editor.value = val.substring(0, start) + nextPrefix + val.substring(end);
          elements.editor.selectionStart = elements.editor.selectionEnd = start + nextPrefix.length;
        }
        renderMarkdown();
        updateCursorPos();
        return;
      }

      // Check unordered list (- , * , + )
      const unorderedMatch = currentLine.match(/^(\s*[-*+]\s+)(.*)$/);
      if (unorderedMatch) {
        const prefix = unorderedMatch[1];
        const content = unorderedMatch[2];

        e.preventDefault();
        if (content.trim() === '') {
          // Empty list item -> clear prefix
          elements.editor.value = val.substring(0, lineStart) + val.substring(start);
          elements.editor.selectionStart = elements.editor.selectionEnd = lineStart;
        } else {
          // Continue bullet list
          const nextPrefix = `\n${prefix}`;
          elements.editor.value = val.substring(0, start) + nextPrefix + val.substring(end);
          elements.editor.selectionStart = elements.editor.selectionEnd = start + nextPrefix.length;
        }
        renderMarkdown();
        updateCursorPos();
        return;
      }

      // Check numbered list (1. , 2. )
      const orderedMatch = currentLine.match(/^(\s*)(\d+)(\.\s+)(.*)$/);
      if (orderedMatch) {
        const indent = orderedMatch[1];
        const num = parseInt(orderedMatch[2], 10);
        const sep = orderedMatch[3];
        const content = orderedMatch[4];

        e.preventDefault();
        if (content.trim() === '') {
          // Empty item -> clear
          elements.editor.value = val.substring(0, lineStart) + val.substring(start);
          elements.editor.selectionStart = elements.editor.selectionEnd = lineStart;
        } else {
          // Continue with next number
          const nextPrefix = `\n${indent}${num + 1}${sep}`;
          elements.editor.value = val.substring(0, start) + nextPrefix + val.substring(end);
          elements.editor.selectionStart = elements.editor.selectionEnd = start + nextPrefix.length;
        }
        renderMarkdown();
        updateCursorPos();
        return;
      }
    }
  }
});

// Cursor Position Tracking
function updateCursorPos() {
  const pos = elements.editor.selectionStart;
  const text = elements.editor.value.substring(0, pos);
  const lines = text.split('\n');
  const line = lines.length;
  const col = lines[lines.length - 1].length + 1;
  elements.cursorPos.textContent = `行: ${line}, 列: ${col}`;
}

elements.editor.addEventListener('keyup', updateCursorPos);
elements.editor.addEventListener('click', updateCursorPos);
elements.editor.addEventListener('input', () => {
  renderMarkdown();
  updateCursorPos();
});

// Keyboard Shortcuts (macOS Command & Windows Ctrl)
window.addEventListener('keydown', (e) => {
  const isCmdOrCtrl = e.metaKey || e.ctrlKey;
  
  if (isCmdOrCtrl && !e.shiftKey && e.key.toLowerCase() === 'f') {
    e.preventDefault();
    openSearchBar();
  } else if (isCmdOrCtrl && !e.shiftKey && e.key.toLowerCase() === 'g') {
    e.preventDefault();
    findNextMatch(1);
  } else if (isCmdOrCtrl && e.shiftKey && e.key.toLowerCase() === 'g') {
    e.preventDefault();
    findNextMatch(-1);
  } else if (e.key === 'Escape' && searchState.isOpen) {
    e.preventDefault();
    closeSearchBar();
  } else if (isCmdOrCtrl && !e.shiftKey && e.key.toLowerCase() === 's') {
    e.preventDefault();
    saveFile();
  } else if (isCmdOrCtrl && e.shiftKey && e.key.toLowerCase() === 's') {
    e.preventDefault();
    saveFileAs();
  } else if (isCmdOrCtrl && !e.shiftKey && e.key.toLowerCase() === 'o') {
    e.preventDefault();
    openFile();
  } else if (isCmdOrCtrl && !e.shiftKey && e.key.toLowerCase() === 'n') {
    e.preventDefault();
    newFile();
  } else if (isCmdOrCtrl && !e.shiftKey && e.key.toLowerCase() === 'e') {
    e.preventDefault();
    if (state.mode === 'view') setMode('edit');
    else if (state.mode === 'edit') setMode('split');
    else setMode('view');
  } else if (isCmdOrCtrl && !e.shiftKey && e.key.toLowerCase() === 'b') {
    e.preventDefault();
    toggleSidebar();
  } else if (isCmdOrCtrl && e.shiftKey && e.key.toLowerCase() === 'c') {
    e.preventDefault();
    copyMarkdown();
  } else if (isCmdOrCtrl && e.shiftKey && e.key.toLowerCase() === 'h') {
    e.preventDefault();
    copyHtml();
  } else if (isCmdOrCtrl && (e.key === '=' || e.key === '+')) {
    e.preventDefault();
    zoomIn();
  } else if (isCmdOrCtrl && e.key === '-') {
    e.preventDefault();
    zoomOut();
  } else if (isCmdOrCtrl && e.key === '0') {
    e.preventDefault();
    zoomReset();
  } else if (isCmdOrCtrl && !e.shiftKey && e.key.toLowerCase() === 'r') {
    e.preventDefault();
    reloadFile();
  }
});

function toggleSidebar() {
  state.sidebarOpen = !state.sidebarOpen;
  localStorage.setItem('mdedit_sidebar_open', state.sidebarOpen);
  elements.body.classList.toggle('sidebar-open', state.sidebarOpen);
  elements.btnToggleSidebar.classList.toggle('active', state.sidebarOpen);
}

// Drag and Drop Files
window.addEventListener('dragover', (e) => {
  e.preventDefault();
  e.stopPropagation();
});

window.addEventListener('drop', async (e) => {
  e.preventDefault();
  e.stopPropagation();

  if (e.dataTransfer && e.dataTransfer.files.length > 0) {
    const file = e.dataTransfer.files[0];
    if (file.name.match(/\.(md|markdown|mdown|mkd|mkdn|txt|csv|tsv|log|py|js|ts|json|yml|yaml|sh|zsh|bash|css|html|toml|conf|ini|env|sql|rs|rb|go|c|cpp|h)$/i)) {
      const reader = new FileReader();
      reader.onload = (event) => {
        loadFilePayload({
          path: file.path || file.name,
          name: file.name,
          content: event.target.result,
          size: file.size,
          last_modified: Date.now()
        });
      };
      reader.readAsText(file);
    } else {
      showToast('テキストファイルをドロップしてください', 'warning');
    }
  }
});

// Markdown Formatting Tool Palette Handler
function applyMarkdownTool(tool) {
  const textarea = elements.editor;
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const text = textarea.value;
  const selectedText = text.substring(start, end);

  let replacement = '';
  let cursorOffset = 0;
  let selectLength = 0;

  switch (tool) {
    case 'h1':
      replacement = selectedText ? `# ${selectedText}` : '# 見出し 1\n';
      cursorOffset = selectedText ? replacement.length : 2;
      selectLength = selectedText ? 0 : 5;
      break;
    case 'h2':
      replacement = selectedText ? `## ${selectedText}` : '## 見出し 2\n';
      cursorOffset = selectedText ? replacement.length : 3;
      selectLength = selectedText ? 0 : 5;
      break;
    case 'h3':
      replacement = selectedText ? `### ${selectedText}` : '### 見出し 3\n';
      cursorOffset = selectedText ? replacement.length : 4;
      selectLength = selectedText ? 0 : 5;
      break;
    case 'bold':
      replacement = selectedText ? `**${selectedText}**` : '**太字テキスト**';
      cursorOffset = selectedText ? replacement.length : 2;
      selectLength = selectedText ? 0 : 6;
      break;
    case 'italic':
      replacement = selectedText ? `*${selectedText}*` : '*斜体テキスト*';
      cursorOffset = selectedText ? replacement.length : 1;
      selectLength = selectedText ? 0 : 6;
      break;
    case 'strike':
      replacement = selectedText ? `~~${selectedText}~~` : '~~取り消し線~~';
      cursorOffset = selectedText ? replacement.length : 2;
      selectLength = selectedText ? 0 : 5;
      break;
    case 'inline-code':
      replacement = selectedText ? `\`${selectedText}\`` : '`コード`';
      cursorOffset = selectedText ? replacement.length : 1;
      selectLength = selectedText ? 0 : 3;
      break;
    case 'kbd':
      replacement = selectedText ? `<kbd>${selectedText}</kbd>` : '<kbd>Cmd</kbd>';
      cursorOffset = selectedText ? replacement.length : 5;
      selectLength = selectedText ? 0 : 3;
      break;
    case 'quote':
      replacement = selectedText ? `> ${selectedText}` : '> 引用テキスト\n';
      cursorOffset = selectedText ? replacement.length : 2;
      selectLength = selectedText ? 0 : 6;
      break;
    case 'code-block':
      replacement = selectedText ? `\`\`\`\n${selectedText}\n\`\`\`\n` : '```\n// コード\n```\n';
      cursorOffset = selectedText ? replacement.length : 4;
      selectLength = selectedText ? 0 : 7;
      break;
    case 'details':
      replacement = selectedText 
        ? `<details>\n<summary>${selectedText}</summary>\n\nここに詳細内容を記述\n</details>\n`
        : '<details>\n<summary>詳細タイトル（クリックで展開）</summary>\n\nここに詳細内容を記述\n</details>\n';
      cursorOffset = selectedText ? selectedText.length + 22 : 19;
      selectLength = selectedText ? 10 : 16;
      break;
    case 'alert-note':
      replacement = selectedText
        ? `> [!NOTE]\n> ${selectedText}\n`
        : '> [!NOTE]\n> ここにメモ・注意事項を記述\n';
      cursorOffset = selectedText ? replacement.length : 11;
      selectLength = selectedText ? 0 : 13;
      break;
    case 'divider':
      replacement = '\n---\n\n';
      cursorOffset = replacement.length;
      break;
    case 'bullet-list':
      replacement = selectedText ? `- ${selectedText}` : '- リスト項目\n';
      cursorOffset = selectedText ? replacement.length : 2;
      selectLength = selectedText ? 0 : 6;
      break;
    case 'number-list':
      replacement = selectedText ? `1. ${selectedText}` : '1. リスト項目\n';
      cursorOffset = selectedText ? replacement.length : 3;
      selectLength = selectedText ? 0 : 6;
      break;
    case 'task-list':
      replacement = selectedText ? `- [ ] ${selectedText}` : '- [ ] タスク項目\n';
      cursorOffset = selectedText ? replacement.length : 6;
      selectLength = selectedText ? 0 : 6;
      break;
    case 'table':
      replacement = '\n| 見出し1 | 見出し2 | 見出し3 |\n| :--- | :---: | ---: |\n| 内容1 | 内容2 | 内容3 |\n| 内容4 | 内容5 | 内容6 |\n\n';
      cursorOffset = replacement.length;
      break;
    case 'link':
      replacement = selectedText ? `[${selectedText}](https://)` : '[リンクテキスト](https://example.com)';
      cursorOffset = selectedText ? selectedText.length + 3 : 1;
      selectLength = selectedText ? 8 : 7;
      break;
    case 'image':
      replacement = selectedText ? `![${selectedText}](https://)` : '![代替テキスト](https://example.com/image.png)';
      cursorOffset = selectedText ? selectedText.length + 4 : 2;
      selectLength = selectedText ? 8 : 6;
      break;
    case 'embed':
      replacement = selectedText ? `![[${selectedText}]]` : '![[ファイル名.ext]]';
      cursorOffset = selectedText ? replacement.length : 3;
      selectLength = selectedText ? 0 : 8;
      break;
    case 'wikilink':
      replacement = selectedText ? `[[${selectedText}]]` : '[[ノート名]]';
      cursorOffset = selectedText ? replacement.length : 2;
      selectLength = selectedText ? 0 : 4;
      break;
    default:
      return;
  }

  textarea.focus();
  textarea.setSelectionRange(start, end);

  // Record native undo step so Cmd+Z can immediately undo tag insertion
  let inserted = false;
  try {
    inserted = document.execCommand('insertText', false, replacement);
  } catch (err) {
    inserted = false;
  }

  if (!inserted) {
    if (typeof textarea.setRangeText === 'function') {
      textarea.setRangeText(replacement, start, end, 'end');
    } else {
      textarea.value = text.substring(0, start) + replacement + text.substring(end);
    }
  }

  if (selectLength > 0) {
    textarea.setSelectionRange(start + cursorOffset, start + cursorOffset + selectLength);
  } else {
    textarea.setSelectionRange(start + cursorOffset, start + cursorOffset);
  }

  setDirty(true);
  renderMarkdown();
  updateCursorPos();
}

// Zoom Controls (Scales content text only while keeping UI fixed)
function setZoom(level, showFeedback = true) {
  state.zoomLevel = Math.min(2.0, Math.max(0.7, Math.round(level * 10) / 10));
  document.body.style.zoom = '';
  document.documentElement.style.setProperty('--content-zoom', state.zoomLevel.toString());
  localStorage.setItem('mdedit_zoom_level', state.zoomLevel.toString());
  if (elements.menuZoomResetLabel) {
    elements.menuZoomResetLabel.textContent = `テキスト拡大率リセット (${Math.round(state.zoomLevel * 100)}%)`;
  }
  if (showFeedback) {
    showToast(`テキスト倍率: ${Math.round(state.zoomLevel * 100)}%`, 'info', 1200);
  }
}

function zoomIn() {
  setZoom(state.zoomLevel + 0.1);
}

function zoomOut() {
  setZoom(state.zoomLevel - 0.1);
}

function zoomReset() {
  setZoom(1.0);
}

// Palette Pinning (Always Expanded State)
function updatePalettePinUI() {
  if (elements.menuPinPalette) {
    elements.menuPinPalette.classList.toggle('checked', state.palettePinned);
  }
  if (state.palettePinned) {
    state.paletteExpanded = true;
    if (elements.editPalette) {
      elements.editPalette.classList.add('palette-expanded');
    }
  }
}

function togglePinPalette() {
  state.palettePinned = !state.palettePinned;
  localStorage.setItem('mdedit_palette_pinned', state.palettePinned ? 'true' : 'false');
  if (state.palettePinned) {
    state.paletteExpanded = true;
    if (elements.editPalette) {
      elements.editPalette.classList.add('palette-expanded');
    }
  }
  updatePalettePinUI();
  showToast(state.palettePinned ? 'パレットを展開固定しました' : 'パレットの展開固定を解除しました', 'info');
}

// Toggle Edit Tool Palette (Expand/Collapse)
function togglePalette() {
  state.paletteExpanded = !state.paletteExpanded;
  if (elements.editPalette) {
    elements.editPalette.classList.toggle('palette-expanded', state.paletteExpanded);
  }
}

if (elements.btnTogglePalette) {
  elements.btnTogglePalette.addEventListener('click', togglePalette);
}

// Palette Drag and Drop Reordering (Pointer Events based for 100% desktop app compatibility)
let activeDragBtn = null;
let dragStartX = 0;
let dragStartY = 0;
let isDraggingPointer = false;
let currentDropTarget = null;
let dropPosition = null; // 'before' | 'after'

function initPaletteDragAndDrop() {
  const buttons = document.querySelectorAll('.palette-btn');
  buttons.forEach(btn => {
    // Touch/Pointer dragging
    btn.addEventListener('pointerdown', (e) => {
      // Left click / primary touch only
      if (e.button !== 0) return;
      activeDragBtn = btn;
      dragStartX = e.clientX;
      dragStartY = e.clientY;
      isDraggingPointer = false;
      currentDropTarget = null;
      dropPosition = null;

      try {
        btn.setPointerCapture(e.pointerId);
      } catch (err) {}
    });

    btn.addEventListener('pointermove', (e) => {
      if (!activeDragBtn || activeDragBtn !== btn) return;

      const deltaX = Math.abs(e.clientX - dragStartX);
      const deltaY = Math.abs(e.clientY - dragStartY);

      if (!isDraggingPointer && (deltaX > 4 || deltaY > 4)) {
        isDraggingPointer = true;
        btn.classList.add('dragging');
        document.body.style.cursor = 'grabbing';
      }

      if (isDraggingPointer) {
        // Clear previous highlights
        buttons.forEach(b => b.classList.remove('drag-over-top', 'drag-over-bottom'));

        // Identify element under pointer
        const elemUnder = document.elementFromPoint(e.clientX, e.clientY);
        const targetBtn = elemUnder ? elemUnder.closest('.palette-btn') : null;

        if (targetBtn && targetBtn !== btn) {
          currentDropTarget = targetBtn;
          const rect = targetBtn.getBoundingClientRect();
          const midY = rect.top + rect.height / 2;
          if (e.clientY < midY) {
            dropPosition = 'before';
            targetBtn.classList.add('drag-over-top');
          } else {
            dropPosition = 'after';
            targetBtn.classList.add('drag-over-bottom');
          }
        } else {
          currentDropTarget = null;
          dropPosition = null;
        }
      }
    });

    btn.addEventListener('pointerup', (e) => {
      if (!activeDragBtn || activeDragBtn !== btn) return;

      if (isDraggingPointer) {
        if (currentDropTarget && currentDropTarget !== btn && dropPosition) {
          const parent = currentDropTarget.parentNode;
          if (dropPosition === 'before') {
            parent.insertBefore(btn, currentDropTarget);
          } else {
            parent.insertBefore(btn, currentDropTarget.nextSibling);
          }
          savePaletteOrder();
          showToast('パレットの並び順を保存しました', 'success', 1200);
        }
      } else {
        // Normal click without drag
        const tool = btn.getAttribute('data-tool');
        if (tool) {
          applyMarkdownTool(tool);
        }
      }

      // Cleanup
      buttons.forEach(b => b.classList.remove('drag-over-top', 'drag-over-bottom', 'dragging'));
      document.body.style.cursor = '';
      activeDragBtn = null;
      isDraggingPointer = false;
      currentDropTarget = null;
      dropPosition = null;

      try {
        btn.releasePointerCapture(e.pointerId);
      } catch (err) {}
    });

    btn.addEventListener('pointercancel', (e) => {
      buttons.forEach(b => b.classList.remove('drag-over-top', 'drag-over-bottom', 'dragging'));
      document.body.style.cursor = '';
      activeDragBtn = null;
      isDraggingPointer = false;
      currentDropTarget = null;
      dropPosition = null;
      try {
        btn.releasePointerCapture(e.pointerId);
      } catch (err) {}
    });
  });
}

function savePaletteOrder() {
  const currentBtns = document.querySelectorAll('.palette-btn');
  const order = Array.from(currentBtns).map(b => b.getAttribute('data-tool')).filter(Boolean);
  localStorage.setItem('mdedit_palette_order', JSON.stringify(order));
}

function applyPaletteOrder() {
  const saved = localStorage.getItem('mdedit_palette_order');
  if (!saved) return;

  try {
    const order = JSON.parse(saved);
    if (!Array.isArray(order) || order.length === 0) return;

    const btnMap = new Map();
    document.querySelectorAll('.palette-btn').forEach(btn => {
      const tool = btn.getAttribute('data-tool');
      if (tool) btnMap.set(tool, btn);
    });

    const groups = document.querySelectorAll('.palette-group');
    if (groups.length === 0) return;

    const firstGroup = groups[0];
    order.forEach(tool => {
      const btn = btnMap.get(tool);
      if (btn && btn.parentNode) {
        btn.parentNode.appendChild(btn);
      }
    });
  } catch (e) {
    console.warn('Failed to apply palette order:', e);
  }
}

function resetPaletteOrder() {
  localStorage.removeItem('mdedit_palette_order');
  showToast('パレット順序を初期化しました', 'info');
  setTimeout(() => location.reload(), 400);
}

// ==========================================
// In-Document Search & Highlight System (Cmd+F / Cmd+G)
// ==========================================
const searchState = {
  isOpen: false,
  query: '',
  matches: [],
  currentIndex: -1
};

function openSearchBar() {
  if (!elements.searchInput) return;
  searchState.isOpen = true;

  if (elements.searchContainer) {
    elements.searchContainer.classList.add('search-expanded');
  }

  // Pre-fill selected text if available
  let selectedText = '';
  if (state.mode === 'edit' || state.mode === 'split') {
    const selStart = elements.editor.selectionStart;
    const selEnd = elements.editor.selectionEnd;
    if (selStart !== selEnd) {
      selectedText = elements.editor.value.substring(selStart, selEnd).trim();
    }
  } else {
    const sel = window.getSelection();
    if (sel && sel.toString()) {
      selectedText = sel.toString().trim();
    }
  }

  if (selectedText && selectedText.length < 50 && !selectedText.includes('\n')) {
    elements.searchInput.value = selectedText;
  }

  elements.searchInput.focus();
  elements.searchInput.select();
  performSearch(elements.searchInput.value);
}

function closeSearchBar() {
  searchState.isOpen = false;
  if (elements.searchContainer) {
    elements.searchContainer.classList.remove('search-expanded');
  }
  if (elements.searchInput) {
    elements.searchInput.value = '';
    elements.searchInput.blur();
  }
  clearSearchHighlights();
  searchState.matches = [];
  searchState.currentIndex = -1;
  searchState.query = '';
  if (elements.searchCount) {
    elements.searchCount.textContent = '0 / 0';
  }

  // Return focus to active workspace
  if (state.mode === 'edit' || state.mode === 'split') {
    elements.editor.focus();
  }
}

function clearSearchHighlights() {
  // Remove mark.mdedit-search-match in preview
  const marks = elements.preview.querySelectorAll('mark.mdedit-search-match');
  marks.forEach(mark => {
    const parent = mark.parentNode;
    if (parent) {
      parent.replaceChild(document.createTextNode(mark.textContent), mark);
      parent.normalize();
    }
  });
}

function highlightInPreview(query) {
  clearSearchHighlights();
  if (!query) return [];

  const matches = [];
  const walker = document.createTreeWalker(
    elements.preview,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode(node) {
        if (!node.nodeValue || !node.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
        // Ignore scripts, styles
        const parentTag = node.parentElement ? node.parentElement.tagName : '';
        if (['SCRIPT', 'STYLE'].includes(parentTag)) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    }
  );

  const textNodes = [];
  let currentNode;
  while ((currentNode = walker.nextNode())) {
    textNodes.push(currentNode);
  }

  const lowerQuery = query.toLowerCase();

  textNodes.forEach(node => {
    const text = node.nodeValue;
    const lowerText = text.toLowerCase();
    let index = lowerText.indexOf(lowerQuery);

    if (index !== -1) {
      const fragment = document.createDocumentFragment();
      let lastIndex = 0;

      while (index !== -1) {
        // Text before match
        if (index > lastIndex) {
          fragment.appendChild(document.createTextNode(text.substring(lastIndex, index)));
        }

        // Highlighted match
        const mark = document.createElement('mark');
        mark.className = 'mdedit-search-match';
        mark.textContent = text.substring(index, index + query.length);
        fragment.appendChild(mark);
        matches.push(mark);

        lastIndex = index + query.length;
        index = lowerText.indexOf(lowerQuery, lastIndex);
      }

      // Remaining text
      if (lastIndex < text.length) {
        fragment.appendChild(document.createTextNode(text.substring(lastIndex)));
      }

      if (node.parentNode) {
        node.parentNode.replaceChild(fragment, node);
      }
    }
  });

  return matches;
}

function performSearch(query) {
  searchState.query = query;

  if (!query) {
    clearSearchHighlights();
    searchState.matches = [];
    searchState.currentIndex = -1;
    if (elements.searchCount) {
      elements.searchCount.textContent = '0 / 0';
    }
    return;
  }

  if (state.mode === 'edit') {
    // Editor search mode (find all indices in textarea)
    const text = elements.editor.value;
    const lowerText = text.toLowerCase();
    const lowerQuery = query.toLowerCase();
    const indices = [];
    let idx = lowerText.indexOf(lowerQuery);
    while (idx !== -1) {
      indices.push(idx);
      idx = lowerText.indexOf(lowerQuery, idx + query.length);
    }
    searchState.matches = indices;
    if (indices.length > 0) {
      searchState.currentIndex = 0;
      jumpToMatch(0);
    } else {
      searchState.currentIndex = -1;
    }
    updateSearchCountUI();
  } else {
    // View or Split mode: highlight in rendered preview DOM
    const markElements = highlightInPreview(query);
    searchState.matches = markElements;
    if (markElements.length > 0) {
      searchState.currentIndex = 0;
      jumpToMatch(0);
    } else {
      searchState.currentIndex = -1;
    }
    updateSearchCountUI();
  }
}

function updateSearchCountUI() {
  if (!elements.searchCount) return;
  const total = searchState.matches.length;
  const current = total > 0 && searchState.currentIndex >= 0 ? searchState.currentIndex + 1 : 0;
  elements.searchCount.textContent = `${current} / ${total}`;
}

function jumpToMatch(index) {
  if (searchState.matches.length === 0) return;
  if (index < 0) index = searchState.matches.length - 1;
  if (index >= searchState.matches.length) index = 0;
  searchState.currentIndex = index;

  updateSearchCountUI();

  if (state.mode === 'edit') {
    // Textarea selection jump
    const pos = searchState.matches[index];
    if (typeof pos === 'number') {
      elements.editor.focus();
      elements.editor.setSelectionRange(pos, pos + searchState.query.length);

      // Scroll textarea to selection line
      const linesBefore = elements.editor.value.substring(0, pos).split('\n').length;
      const totalLines = elements.editor.value.split('\n').length;
      const lineHeight = elements.editor.scrollHeight / (totalLines || 1);
      elements.editor.scrollTop = Math.max(0, (linesBefore - 5) * lineHeight);
    }
  } else {
    // Preview mark element jump
    elements.preview.querySelectorAll('mark.mdedit-search-match').forEach(m => m.classList.remove('active-match'));
    const mark = searchState.matches[index];
    if (mark && mark.classList) {
      mark.classList.add('active-match');
      mark.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
    }
  }
}

function findNextMatch(direction = 1) {
  if (!searchState.isOpen) {
    openSearchBar();
    return;
  }
  if (searchState.matches.length === 0) {
    if (elements.searchInput && elements.searchInput.value) {
      performSearch(elements.searchInput.value);
    }
    return;
  }
  const nextIdx = searchState.currentIndex + direction;
  jumpToMatch(nextIdx);
}


// Sidebar Tab switching
elements.tabVault.addEventListener('click', () => switchSidebarTab('vault'));
elements.tabToc.addEventListener('click', () => switchSidebarTab('toc'));

// Vault Actions
elements.btnObsidianVault.addEventListener('click', toggleObsidianMode);
elements.btnChangeVault.addEventListener('click', changeVaultFolder);
elements.btnRefreshVault.addEventListener('click', () => loadVaultTree());
elements.vaultSearchInput.addEventListener('input', (e) => {
  renderVaultTree(e.target.value.trim());
});

// UI Event Listeners
elements.modeView.addEventListener('click', () => setMode('view'));
elements.modeEdit.addEventListener('click', () => setMode('edit'));
elements.modeSplit.addEventListener('click', () => setMode('split'));

elements.btnToggleSidebar.addEventListener('click', toggleSidebar);
if (elements.btnBrand) {
  elements.btnBrand.addEventListener('click', showWelcomeManual);
}
// Search Bar Event Listeners
if (elements.btnSearchToggle) {
  elements.btnSearchToggle.addEventListener('click', () => {
    if (elements.searchContainer && elements.searchContainer.classList.contains('search-expanded')) {
      closeSearchBar();
    } else {
      openSearchBar();
    }
  });
}
if (elements.btnSearchClear) {
  elements.btnSearchClear.addEventListener('click', () => {
    closeSearchBar();
  });
}
if (elements.btnSearchNext) {
  elements.btnSearchNext.addEventListener('click', () => findNextMatch(1));
}
if (elements.btnSearchPrev) {
  elements.btnSearchPrev.addEventListener('click', () => findNextMatch(-1));
}
if (elements.searchInput) {
  elements.searchInput.addEventListener('input', (e) => {
    performSearch(e.target.value);
  });
  elements.searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      findNextMatch(e.shiftKey ? -1 : 1);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      closeSearchBar();
    }
  });
}

if (elements.btnNew) elements.btnNew.addEventListener('click', newFile);
if (elements.btnOpen) elements.btnOpen.addEventListener('click', openFile);
if (elements.btnSaveToVault) elements.btnSaveToVault.addEventListener('click', saveToObsidianVault);
if (elements.btnSave) elements.btnSave.addEventListener('click', saveFile);
if (elements.btnReload) elements.btnReload.addEventListener('click', reloadFile);

elements.btnMore.addEventListener('click', (e) => {
  e.stopPropagation();
  elements.moreMenu.classList.toggle('show');
});

document.addEventListener('click', () => {
  elements.moreMenu.classList.remove('show');
});

if (elements.menuDownloadManual) {
  elements.menuDownloadManual.addEventListener('click', downloadManual);
}

if (elements.menuPinPalette) {
  elements.menuPinPalette.addEventListener('click', togglePinPalette);
}

if (elements.menuZoomIn) {
  elements.menuZoomIn.addEventListener('click', zoomIn);
}

if (elements.menuZoomOut) {
  elements.menuZoomOut.addEventListener('click', zoomOut);
}

if (elements.menuZoomReset) {
  elements.menuZoomReset.addEventListener('click', zoomReset);
}

if (elements.menuResetPaletteOrder) {
  elements.menuResetPaletteOrder.addEventListener('click', resetPaletteOrder);
}

// Auto Update Checker (Tauri Updater Plugin)
async function checkForUpdates(manual = true) {
  if (!isTauri) {
    if (manual) showToast('アップデート確認はデスクトップアプリ版でのみ利用可能です', 'info');
    return;
  }

  try {
    if (manual) showToast('最新アップデートを確認中...', 'info', 2000);
    const { check } = await import('@tauri-apps/plugin-updater');
    const update = await check();

    if (update) {
      // Show pulsing red badge on the 3-dots menu icon
      if (elements.updateBadgeDot) {
        elements.updateBadgeDot.style.display = 'block';
      }

      const confirmUpdate = confirm(
        `新しいバージョン (v${update.version}) が利用可能です！\n\n更新内容:\n${update.body || '機能改善とバグ修正'}\n\n今すぐアップデートをダウンロードして再起動しますか？`
      );

      if (confirmUpdate) {
        showToast(`v${update.version} をダウンロード中...`, 'info', 6000);
        let downloaded = 0;
        let contentLength = 0;

        await update.downloadAndInstall((event) => {
          switch (event.event) {
            case 'Started':
              contentLength = event.data.contentLength || 0;
              break;
            case 'Progress':
              downloaded += event.data.chunkLength;
              break;
            case 'Finished':
              showToast('アップデート完了！アプリを再起動します', 'success', 2500);
              break;
          }
        });

        const { relaunch } = await import('@tauri-apps/plugin-process');
        await relaunch();
      }
    } else {
      if (elements.updateBadgeDot) {
        elements.updateBadgeDot.style.display = 'none';
      }
      if (manual) {
        showToast('お使いの MdEdit は最新バージョンです', 'success');
      }
    }
  } catch (err) {
    console.error('Update check error:', err);
    if (manual) {
      const errStr = String(err && err.message ? err.message : err);
      if (errStr.includes('Could not fetch') || errStr.includes('404')) {
        showToast('最新バージョンの配信準備中（GitHub Actions 実行中）です', 'info', 3500);
      } else {
        showToast(`アップデート確認: ${errStr}`, 'info', 3000);
      }
    }
  }
}

elements.menuSaveAs.addEventListener('click', saveFileAs);
elements.menuCopyMd.addEventListener('click', copyMarkdown);
elements.menuCopyHtml.addEventListener('click', copyHtml);
elements.menuExportHtml.addEventListener('click', exportHtmlFile);
elements.menuPrintPdf.addEventListener('click', () => window.print());
if (elements.menuCheckUpdate) {
  elements.menuCheckUpdate.addEventListener('click', () => checkForUpdates(true));
}
elements.menuShowFinder.addEventListener('click', showInFinder);

// Initialize Application
async function init() {
  await initTauri();

  // Initialize UI features
  setZoom(state.zoomLevel, false);
  updatePalettePinUI();
  applyPaletteOrder();
  initPaletteDragAndDrop();

  // Restore Sidebar & Obsidian state from previous session
  elements.body.classList.toggle('sidebar-open', state.sidebarOpen);
  elements.btnToggleSidebar.classList.toggle('active', state.sidebarOpen);
  switchSidebarTab(state.activeSidebarTab);
  syncObsidianModeUI();

  // Initialize Vault Tree in background
  loadVaultTree();

  // Load initial file if provided
  let initialLoaded = false;
  if (isTauri && tauriCore) {
    try {
      const initialPayload = await tauriCore.invoke('get_initial_file');
      if (initialPayload) {
        loadFilePayload(initialPayload);
        initialLoaded = true;
      }

      // Listen for open file events from Tauri (Finder double click / open with)
      if (tauriEvent) {
        await tauriEvent.listen('open-file-event', async (event) => {
          const path = event.payload;
          if (path) {
            try {
              const payload = await tauriCore.invoke('read_file', { path });
              loadFilePayload(payload);
            } catch (e) {
              console.error('Failed to open file event:', e);
            }
          }
        });
      }
    } catch (e) {
      console.warn('Initial file fetch failed:', e);
    }
  }

  if (!initialLoaded) {
    // Official User Manual as the Welcome Document
    loadFilePayload({
      path: '',
      name: 'Welcome.md',
      content: MANUAL_DOC,
      size: MANUAL_DOC.length,
      last_modified: Date.now()
    }, true);
  }

  // Check for updates quietly in background (shows badge if update available)
  if (isTauri) {
    setTimeout(() => {
      checkForUpdates(false);
    }, 3000);
  }
}

init();
