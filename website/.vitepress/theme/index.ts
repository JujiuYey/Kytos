import DefaultTheme from 'vitepress/theme';
import HomePage from './components/home-page.vue';
import './custom.css';

export default {
  extends: DefaultTheme,
  enhanceApp({ app }) {
    app.component('HomePage', HomePage);
  },
};
