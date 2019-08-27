// alternative: https://github.com/markdown-it/markdown-it, ...
var renderer = new marked.Renderer();
renderer.link = function(href, title, text) {
  var link = marked.Renderer.prototype.link.call(this, href, title, text);
  return link.replace("<a","<a target='_blank' ");
};
marked.setOptions({
  renderer: renderer
});
window.onload = function() {
  document.getElementById('content').innerHTML =
    marked( document.getElementById('content').innerHTML );
}
