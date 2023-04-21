const express = require('express');
const app = express();
const port = 3000;

// Static user and password for authentication
const staticUser = 'user';
const staticPassword = 'password';

// Serve the login page
app.get('/login', (req, res) => {
  res.send(`
    <html>
      <body>
        <h1>Login</h1>
        <form onsubmit="submitForm(event)">
          <label>
            Username:
            <input id="username" type="text" value="user" required />
          </label>
          <br />
          <label>
            Password:
            <input id="password" type="text" value="password" required />
          </label>
          <br />
          <button type="submit">Log in</button>
        </form>
        <script>
          async function submitForm(event) {
            event.preventDefault();
            const username = document.getElementById('username').value;
            const password = document.getElementById('password').value;

            // Send the username and password to the server for validation
            const response = await fetch('/validate?username=' + encodeURIComponent(username) + '&password=' + encodeURIComponent(password));
            const { valid } = await response.json();

            if (valid) {
              // If the credentials are valid, call the custom URI with a sample token
              location.href = 'myapp://sample_token';
            } else {
              alert('Invalid username or password');
            }
          }
        </script>
      </body>
    </html>
  `);
});

// Validate the username and password
app.get('/validate', (req, res) => {
  const {username, password} = req.query;
  const valid = username === staticUser && password === staticPassword;
  res.json({valid});
});

app.listen(port, () => {
  console.log(`Server listening at http://localhost:${port}`);
});
