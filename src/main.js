import './styles.css';
import './postnet-ui.css';
import './postnet-board.css';
import { installWizardValidation } from './app/wizardValidation.js';
import { installMachineEstimatorUi } from './app/machineEstimatorUi.js';
import { initApp } from './app/app.js';

installWizardValidation();
installMachineEstimatorUi();
initApp();
