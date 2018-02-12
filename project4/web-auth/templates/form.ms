<!DOCTYPE html>
<html>
  <head>
    <title>User Registration</title>
    <link rel="stylesheet" href="/css/style.css">
  </head>
  <body>
    <h1>{{title}}</h1>
    <p class="error">{{errors.formError}}</p>
    <form method="POST" action="{{url}}">
      {{#fields}}
      <label>
	<span class="label">{{info.friendlyName}}</span>
	<input name="{{info.name}}" class="control" value="{{value}}"
	  {{#info.type}}type="{{info.type}}"{{/info.type}}><br>
	{{#error}}
	  <span class="error">{{error}}<br></span>
	{{/error}}
      </label>
      {{/fields}}
      <input name="submit" type="submit" value="{{action}}" class="control">
    </form> 
    <p><a href="{{linkUrl}}">{{linkAction}}</a></p>
  </body>
</html>
