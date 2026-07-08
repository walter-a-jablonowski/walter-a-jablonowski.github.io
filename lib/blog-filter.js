// Blog tag filter for sidebar tag cloud
(function() {
  document.addEventListener('DOMContentLoaded', function() {
    const tagCloud = document.querySelector('.tag-cloud');
    if(!tagCloud) return;

    const items = document.querySelectorAll('.blog-item');
    if(!items.length) return;

    const allTag = tagCloud.querySelector('[data-filter="all"]');
    const tags = tagCloud.querySelectorAll('a[data-filter]');

    let activeFilter = 'all';

    function applyFilter(filter) {
      activeFilter = filter;

      tags.forEach(function(t) {
        const tFilter = t.getAttribute('data-filter');
        if(tFilter === filter) {
          t.classList.add('alt');
        } else {
          t.classList.remove('alt');
        }
      });

      let visibleCount = 0;

      items.forEach(function(item) {
        if(filter === 'all') {
          item.style.display = '';
          visibleCount++;
          return;
        }

        const itemTags = item.querySelectorAll('.blog-meta .tag');
        let match = false;
        itemTags.forEach(function(it) {
          if(it.textContent.trim() === filter) match = true;
        });

        item.style.display = match ? '' : 'none';
        if(match) visibleCount++;
      });

      const noResults = document.querySelector('.blog-no-results');
      if(noResults) {
        noResults.style.display = visibleCount === 0 ? 'block' : 'none';
      }
    }

    tags.forEach(function(tag) {
      tag.addEventListener('click', function(e) {
        e.preventDefault();
        const filter = tag.getAttribute('data-filter');
        if(filter === activeFilter) {
          applyFilter('all');
        } else {
          applyFilter(filter);
        }
      });
    });
  });
})();
