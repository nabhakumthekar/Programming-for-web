<!DOCTYPE html>
<html>
  <head>
    <title>User Account</title>
    <link rel="stylesheet" href="/css/style.css">
  </head>
  <body>
    <h1>User Account</h1>
    <dl>
      <dt class="label">First Name</dt>
      <dd>{{firstName}}</dd>
      <dt class="label">Last Name</dt>
      <dd>{{lastName}}</dd>
    </dl>
    <p>
      <form method="POST" action="/logout">
        <input type="submit" value="Logout">
      </form>	
    </p>
  </body>
</html>
