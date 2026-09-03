declare const chrome: { devtools: { panels: { create(title: string, icon: string, page: string): void } } }

chrome.devtools.panels.create('Agent View', '', 'panel.html')
