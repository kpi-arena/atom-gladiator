import { CompositeDisposable } from 'atom';
import CommandPalleteView from './ui';

const subscriptions = new CompositeDisposable();
const insertView = new CommandPalleteView();

// export function activate(pane: ArenaPane, client: GladiatorConfClient) {
//   // client = clientParam;

//   if (!cli.isInstalled()) {
//     atom.notifications.addFatalError('gladiator-cli is not installed');
//     return false;
//   } else {
//     cli
//       .getSchemaUri()
//       .then(value =>
//         client.addSchema(
//           value.replace(/\r?\n|\r/, ''),
//           `/${cli.CONFIG_FILE_NAME}`,
//         ),
//       );
//   }

//   subscriptions.add(
//     atom.commands.add('atom-workspace', {
//       'gladiator:toggle': () => pane.toggle(),
//     }),

//     atom.commands.add('atom-workspace', {
//       'gladiator:hide': () => pane.hide(),
//     }),

//     atom.commands.add('atom-workspace', {
//       'gladiator:show': () => pane.show(),
//     }),

//     atom.commands.add('atom-workspace', {
//       'gladiator:generate': () =>
//         insertView.open(
//           'Enter the project directory',
//           getProjectOrHomePath(),
//           'Enter the path of the directory in which the files will be generated.',
//           (input: string) => {
//             cli
//               .generateFilesToDir(input)
//               .then(message => {
//                 // config.setPath(path.join(input, cli.CONFIG_FILE_NAME));
//                 if (atom.project.getPaths().indexOf(input) < 0) {
//                   atom.open({
//                     pathsToOpen: [
//                       input,
//                       path.join(input, cli.CONFIG_FILE_NAME),
//                     ],
//                     newWindow: true,
//                   });
//                 } else {
//                   atom.open({
//                     pathsToOpen: [path.join(input, cli.CONFIG_FILE_NAME)],
//                   });
//                   atom.notifications.addSuccess(`${message}`);
//                 }
//               })
//               .catch(message => {
//                 atom.notifications.addError(`${message}`);
//               });
//           },
//         ),
//     }),

//     // atom.commands.add('atom-workspace', {
//     //   'gladiator:set-config-path': () =>
//     //     insertView.open(
//     //       'Enter the config file path',
//     //       getProjectOrHomePath(),
//     //       'Enter the path to the `.gladiator.yml` config file.',
//     //       config.setPath,
//     //     ),
//     // }),

//     atom.commands.add('atom-workspace', {
//       'gladiator:test': () =>
//         cli
//           .test(atom.project.getPaths()[0])
//           .then(value => console.log(value))
//           .catch(value => console.log(value)),
//       // getGladiatorConfPath().forEach(value => console.log(value)),
//     }),
//   );

//   return true;
// }

// export function deactivate() {
//   if (subscriptions !== null) {
//     subscriptions.dispose();
//   }
// }
