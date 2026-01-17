import { LanguageDescription } from '@codemirror/language';

export const supportedLanguages = [
  // Vue
  LanguageDescription.of({
    name: 'VUE',
    extensions: ['vue'],
    async load() {
      return import('@codemirror/lang-vue').then((module) => module.vue());
    },
  }),

  // TypeScript
  LanguageDescription.of({
    name: 'TS',
    extensions: ['ts'],
    async load() {
      return import('@codemirror/lang-javascript').then((module) => module.javascript({ typescript: true }));
    },
  }),

  // JavaScript
  LanguageDescription.of({
    name: 'JS',
    extensions: ['js', 'mjs', 'cjs'],
    async load() {
      return import('@codemirror/lang-javascript').then((module) => module.javascript());
    },
  }),

  // TypeScript JSX
  LanguageDescription.of({
    name: 'TSX',
    extensions: ['tsx'],
    async load() {
      return import('@codemirror/lang-javascript').then((module) => module.javascript({ jsx: true, typescript: true }));
    },
  }),

  // JavaScript JSX
  LanguageDescription.of({
    name: 'JSX',
    extensions: ['jsx'],
    async load() {
      return import('@codemirror/lang-javascript').then((module) => module.javascript({ jsx: true }));
    },
  }),

  // HTML
  LanguageDescription.of({
    name: 'HTML',
    extensions: ['html'],
    async load() {
      return import('@codemirror/lang-html').then((module) => module.html());
    },
  }),

  // CSS
  LanguageDescription.of({
    name: 'CSS',
    extensions: ['css'],
    async load() {
      return import('@codemirror/lang-css').then((module) => module.css());
    },
  }),

  // SASS
  LanguageDescription.of({
    name: 'SASS',
    extensions: ['sass'],
    async load() {
      return import('@codemirror/lang-sass').then((module) => module.sass({ indented: true }));
    },
  }),

  // SCSS
  LanguageDescription.of({
    name: 'SCSS',
    extensions: ['scss'],
    async load() {
      return import('@codemirror/lang-sass').then((module) => module.sass({ indented: false }));
    },
  }),

  // JSON
  LanguageDescription.of({
    name: 'JSON',
    extensions: ['json'],
    async load() {
      return import('@codemirror/lang-json').then((module) => module.json());
    },
  }),

  // Markdown
  LanguageDescription.of({
    name: 'Markdown',
    extensions: ['md'],
    async load() {
      return import('@codemirror/lang-markdown').then((module) => module.markdown());
    },
  }),

  // WebAssembly
  LanguageDescription.of({
    name: 'Wasm',
    extensions: ['wat'],
    async load() {
      return import('@codemirror/lang-wast').then((module) => module.wast());
    },
  }),

  // Python
  LanguageDescription.of({
    name: 'Python',
    extensions: ['py'],
    async load() {
      return import('@codemirror/lang-python').then((module) => module.python());
    },
  }),

  // C/C++
  LanguageDescription.of({
    name: 'C++',
    extensions: ['cpp', 'cc', 'cxx', 'hpp', 'h', 'c'],
    async load() {
      return import('@codemirror/lang-cpp').then((module) => module.cpp());
    },
  }),

  // Go
  LanguageDescription.of({
    name: 'Go',
    extensions: ['go'],
    async load() {
      return import('@codemirror/lang-go').then((module) => module.go());
    },
  }),

  // Rust
  LanguageDescription.of({
    name: 'Rust',
    extensions: ['rs'],
    async load() {
      return import('@codemirror/lang-rust').then((module) => module.rust());
    },
  }),

  // Java
  LanguageDescription.of({
    name: 'Java',
    extensions: ['java'],
    async load() {
      return import('@codemirror/lang-java').then((module) => module.java());
    },
  }),

  // PHP
  LanguageDescription.of({
    name: 'PHP',
    extensions: ['php', 'phtml'],
    async load() {
      return import('@codemirror/lang-php').then((module) => module.php());
    },
  }),

  // SQL
  LanguageDescription.of({
    name: 'SQL',
    extensions: ['sql'],
    async load() {
      return import('@codemirror/lang-sql').then((module) => module.sql());
    },
  }),

  // XML
  LanguageDescription.of({
    name: 'XML',
    extensions: ['xml', 'svg', 'xsl', 'xslt'],
    async load() {
      return import('@codemirror/lang-xml').then((module) => module.xml());
    },
  }),

  // YAML
  LanguageDescription.of({
    name: 'YAML',
    extensions: ['yaml', 'yml'],
    async load() {
      return import('@codemirror/lang-yaml').then((module) => module.yaml());
    },
  }),

  // Angular
  LanguageDescription.of({
    name: 'Angular',
    extensions: ['component.ts', 'module.ts', 'service.ts'],
    async load() {
      return import('@codemirror/lang-angular').then((module) => module.angular());
    },
  }),

  // Less
  LanguageDescription.of({
    name: 'Less',
    extensions: ['less'],
    async load() {
      return import('@codemirror/lang-less').then((module) => module.less());
    },
  }),

  // Liquid (Shopify templates)
  LanguageDescription.of({
    name: 'Liquid',
    extensions: ['liquid'],
    async load() {
      return import('@codemirror/lang-liquid').then((module) => module.liquid());
    },
  }),
];

export async function getLanguage(fileName: string) {
  const languageDescription = LanguageDescription.matchFilename(supportedLanguages, fileName);

  if (languageDescription) {
    try {
      return await languageDescription.load();
    } catch (error) {
      // Language module not installed, return undefined
      console.warn(`Language module not available for ${fileName}:`, error);

      return undefined;
    }
  }

  return undefined;
}
