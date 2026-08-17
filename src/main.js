import './styles.css';
import './postnet-ui.css';
import './postnet-board.css';
import { installWizardValidation } from './app/wizardValidation.js';
import { initApp } from './app/app.js';

installWizardValidation();
initApp();
