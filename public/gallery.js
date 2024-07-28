document.addEventListener('DOMContentLoaded', () => {
  const BASE_URL = 'http://localhost:3002';
  const galleryContainer = document.querySelector('.gallery-container');
  const searchInput = document.querySelector('#search');
  const fileInput = document.querySelector('#file-input');

  function bindButtonEvents() {
    document.querySelectorAll('.copy-url-button').forEach(button => {
      button.addEventListener('click', () => {
        const relativeUrl = button.getAttribute('data-url');
        const fullUrl = `${BASE_URL}${relativeUrl}`;
        navigator.clipboard.writeText(fullUrl)
          .then(() => alert(`URL copied to clipboard: ${fullUrl}`))
          .catch(err => console.error('Failed to copy URL: ', err));
      });
    });

    document.querySelectorAll('.delete-button').forEach(button => {
      button.addEventListener('click', async () => {
        const relativeUrl = button.getAttribute('data-url');
        try {
          const response = await fetch('/delete', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ url: relativeUrl })
          });
          if (response.ok) {
            alert('File deleted');
            button.closest('.gallery-item').remove();
          } else {
            alert('Failed to delete file');
          }
        } catch (err) {
          console.error('Error deleting file: ', err);
        }
      });
    });
  }

  bindButtonEvents();

  if (fileInput) {
    fileInput.addEventListener('change', (event) => {
      const file = event.target.files[0];
      if (!file) return;

      const formData = new FormData();
      formData.append('file', file);

      fetch('/upload', {
        method: 'POST',
        body: formData
      })
      .then(response => response.json())
      .then(data => {
        if (!data.url || !data.mimetype) {
          console.error('Invalid response data:', data);
          return;
        }

        const filename = file.name; // Use the original file name from the input
        const fullUrl = `${BASE_URL}${data.url}`;
        const fileItem = document.createElement('div');
        fileItem.className = 'gallery-item';

        const filePreview = document.createElement('div');
        filePreview.className = 'file-preview';

        if (data.mimetype.startsWith('image/')) {
          filePreview.innerHTML = `<img src="${fullUrl}" alt="${filename}" class="gallery-preview">`;
        } else if (data.mimetype.startsWith('video/')) {
          filePreview.innerHTML = `<video controls class="gallery-preview"><source src="${fullUrl}" type="${data.mimetype}">Your browser does not support the video tag.</video>`;
        } else if (data.mimetype.startsWith('audio/')) {
          filePreview.innerHTML = `<audio controls class="gallery-preview"><source src="${fullUrl}" type="${data.mimetype}">Your browser does not support the audio element.</audio>`;
        } else if (data.mimetype.startsWith('text/')) {
          filePreview.innerHTML = `<iframe src="${fullUrl}" class="gallery-preview"></iframe>`;
        } else {
          filePreview.innerHTML = '<p>Preview not available</p>';
        }

        const fileInfo = document.createElement('div');
        fileInfo.className = 'file-info';
        fileInfo.innerHTML = `
          <p class="file-url-container">${filename}</p>
          <button class="copy-url-button" data-url="${data.url}">Copy URL</button>
          <button class="delete-button" data-url="${data.url}">Delete</button>
        `;

        fileItem.appendChild(filePreview);
        fileItem.appendChild(fileInfo);

        galleryContainer.appendChild(fileItem);

        bindButtonEvents();
      })
      .catch(error => console.error('Error uploading file:', error));
    });
  }

  if (searchInput) {
    searchInput.addEventListener('input', () => {
      const query = searchInput.value.toLowerCase();
      const items = document.querySelectorAll('.gallery-item');
      items.forEach(item => {
        const filename = item.querySelector('.file-url-container').textContent.toLowerCase();
        item.style.display = filename.includes(query) ? 'block' : 'none';
      });
    });
  }

  document.addEventListener('keydown', e => {
    if (e.key === 'f' || e.key === 'F') {
      const navbar = document.querySelector('.navbar');
      navbar.style.display = (navbar.style.display === 'none' || navbar.style.display === '') ? 'flex' : 'none';
    }
  });
});
