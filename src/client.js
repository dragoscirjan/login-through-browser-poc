/* eslint-disable max-lines-per-function */
const {exec} = require('child_process');
const {existsSync, writeFileSync} = require('fs');
const {join: pathJoin} = require('path');
const axios = require('axios');
const express = require('express');
const open = require('open');
const Winreg = require('winreg');

// Custom protocol
const appName = 'POC For Browser Login';
const protocol = 'myapp://';
const protocolName = protocol.slice(0, -3);

const handler = `${process.argv[0]} ${pathJoin(__dirname, 'client.js --offer-token')}`;

const checkKeyExists = (keyPath) => {
  return new Promise((resolve, reject) => {
    const regKey = new Winreg({hive: Winreg.HKCR, key: keyPath});
    regKey.keyExists((err, exists) => {
      if (err) {
        return reject(`Error checking registry key ${keyPath}: ${err.message}`);
      }
      return resolve(exists);
    });
  });
};

const createKey = async (keyPath) => {
  return new Promise((resolve, reject) => {
    const regKey = new Winreg({hive: Winreg.HKCR, key: keyPath});
    regKey.create((err) => {
      if (err) {
        return reject(`Error creating registry key ${keyPath}: ${err.message}`);
      }
      return resolve(`Registry key ${keyPath} created successfully`);
    });
  });
};

const setKeyValue = async (keyPath, name, value) => {
  return new Promise((resolve, reject) => {
    const regKey = new Winreg({hive: Winreg.HKCR, key: keyPath});
    regKey.set(name, Winreg.REG_SZ, value, (err) => {
      if (err) {
        return reject(`Error setting value for registry key ${keyPath}: ${err.message}`);
      }
      return resolve(`Value for registry key ${keyPath} set successfully`);
    });
  });
};

/**
 * @link https://css-tricks.com/hyperlinking-beyond-the-web/
 */
const installUriHandlerForWin32 = async () => {
  try {
    const keyExists = await checkKeyExists(`\\${protocolName}`);
    if (!keyExists) {
      await createKey(`\\${protocolName}`);
      await setKeyValue(`\\${protocolName}`, '', appName);
      await setKeyValue(`\\${protocolName}`, 'URL Protocol', '');

      await createKey(`\\${protocolName}\\shell`);
      await createKey(`\\${protocolName}\\shell\\open`);
      await createKey(`\\${protocolName}\\shell\\open\\command`);

      // const scriptPath = pathJoin(__dirname, '..', '.scripts', 'client-windows-debug.ps1');
      // await setKeyValue(
      //   `\\${protocolName}\\shell\\open\\command`,
      //   '',
      //   `powershell -File ${scriptPath} "${process.argv[0]}" %1`,
      // );
      await setKeyValue(`\\${protocolName}\\shell\\open\\command`, '', `${handler} %1`);
    }
  } catch (e) {
    throw new Error(`Error registering custom URI handler: ${e.message}`);
  }
  console.log('Custom URI handler registered successfully');
};

const installUriHandlerForDarwin = async () => {
  // eslint-disable-next-line max-len
  // return `echo '<?xml version="1.0"?><!DOCTYPE plist PUBLIC "-//Apple/DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd"><plist version="1.0"><dict><key>CFBundleURLTypes</key><array><dict><key>CFBundleURLName</key><string>myapp</string><key>CFBundleURLSchemes</key><array><string>myapp</string></array></dict></array></dict></plist>' > ~/Library/Preferences/${protocol.slice(
  //   0,
  //   -2
  // )}.plist`;
};

const installUriHandlerForLinux = async () => {
  const dp = pathJoin(process.env.HOME, ...'.local/share/applications'.split('/'), `${protocolName}.desktop`);
  if (!existsSync(dp)) {
    // write the myapp.desktop application file
    writeFileSync(
      dp,
      `[Desktop Entry]
Version=1.0
Terminal=true
Type=Application
Name=${appName}
#Exec=${pathJoin(__dirname, '..', '.scripts', 'client-debug-linux')} "${process.argv[0]}" %u
Exec=${handler} %u
StartupNotify=false
MimeType=x-scheme-handler/${protocolName};
NoDisplay=false`,
    );

    // register the application file type (uri) to XDG
    // (some forums say you need to run upgrade-desktop-database command as well)
    // to view it was registered use: xdg-mime query default x-scheme-handler/${protocolName}
    const command = `xdg-mime default ${protocolName}.desktop x-scheme-handler/${protocolName}`;
    // console.log(command);
    await new Promise((resolve, reject) => {
      exec(command, (error, stdout, stderr) => {
        if (error) {
          reject(`Error registering custom URI handler: ${error.message}`);
        } else {
          exec('update-desktop-database ~/.local/share/applications/', (e, o, r) => {
            if (e) {
              reject(`Error registering custom URI handler: ${error.message}`);
            } else {
              resolve();
              console.log('Custom URI handler registered successfully');
            }
          });
        }
      });
    });
  }
};

const installUriHandler = async () => {
  switch (process.platform) {
    case 'win32':
      return installUriHandlerForWin32();
    case 'darwin':
      return installUriHandlerForDarwin();
    case 'linux':
      return installUriHandlerForLinux();
    default:
      console.log('Unsupported platform');
      process.exit(1);
  }
  return null;
};

const startListener = () => {
  // create a listener server which will wait for the access token to be provided
  // this can be a web server (as implemented here) or any other method of process to process communicaton
  // the important part is for the programming language to support it
  const app = express();
  const port = 4000;

  // Endpoint to receive the token from the token_handler.js
  app.get('/receive-token', (req, res) => {
    const token = req.query.token;
    console.log('Access Token:', token);

    // You can now use the token to authenticate API requests to your microservices

    res.send('Token received');
    process.exit(0);
  });

  app.listen(port, () => {
    console.log(`Launcher listening at http://localhost:${port}`);
  });
};

// Set up a custom URI handler for the command-line tool

(async () => {
  // uri handler can even be skipped
  // if the browser will call http://localhost:4000/receive-token?token=${token}
  // instead of the custom --offer-token client run, it's pretty much the same thing
  // !!! things become more complicated when security issues occur
  await installUriHandler();

  // if --offer-token argument is specified, then the client is used just to push the token (see bellow)
  if (!process.argv.includes('--offer-token')) {
    // start listener
    startListener();

    // Launch the login page in the default browser
    open('http://localhost:3000/login');
  } else {
    // parse the token value
    const token = process.argv[process.argv.indexOf('--offer-token') + 1];

    // pass the token value to the listener
    axios.get(`http://localhost:4000/receive-token?token=${token}`);
  }
})();
