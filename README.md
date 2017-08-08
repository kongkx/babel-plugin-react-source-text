# babel-plugin-react-source-text

```javascript
// origin Example.js
import React from 'react';

const Example = () => (
  <div>Example</div>
)

export default Example;
```

Compiled

```javascript
import Example from 'Example';
console.log(Example.__sourceText);
```
