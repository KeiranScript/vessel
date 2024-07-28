document.addEventListener('DOMContentLoaded', () => {
  fetch('/motd')
    .then(response => response.text())
    .then(data => {
      document.getElementById('motd').innerText = data;
    })
    .catch(error => {
      console.error('Error fetching MOTD:', error);
      document.getElementById('motd').innerText = 'Failed to load MOTD';
  });
  const enterButton = document.getElementById('enter-button');
  if (enterButton) {
    enterButton.addEventListener('click', () => {
      document.getElementById('intro-screen').style.display = 'none';
    });
  }

  const uploadForm = document.getElementById('upload-form');
  if (uploadForm) {
    const uploadLink = document.querySelector('.navbar a[href="/upload"]');
    if (uploadLink) {
      uploadLink.addEventListener('click', (event) => {
        event.preventDefault();
        uploadForm.style.display = uploadForm.style.display === 'none' ? 'block' : 'none';
      });
    }
  }

  const selectFileButton = document.getElementById('select-file-button');
  const fileInput = document.getElementById('file-input');
  if (selectFileButton && fileInput) {
    selectFileButton.addEventListener('click', () => {
      fileInput.click();
    });

    fileInput.addEventListener('change', () => {
      const file = fileInput.files[0];
      if (!file) return;

      const formData = new FormData();
      formData.append('file', file);

      fetch('/upload', {
        method: 'POST',
        body: formData
      })
      .then(response => response.json())
      .then(data => {
        console.log('File uploaded successfully:', data);
        alert('File uploaded successfully!');
        
        // Update the file count on the page
        const descriptionElement = document.querySelector('.bio-card .description');
        if (descriptionElement) {
          descriptionElement.textContent = `${data.fileCount} uploads`; // Update file count
        }
      })
      .catch(error => {
        console.error('Error uploading file:', error);
        alert('Failed to upload file.');
      });
    });
  }

  document.querySelectorAll('.copy-url-button').forEach(button => {
    button.addEventListener('click', () => {
      const url = button.getAttribute('data-url');
      navigator.clipboard.writeText(url)
        .then(() => alert('URL copied to clipboard'))
        .catch(err => console.error('Failed to copy URL: ', err));
    });
  });

  document.querySelectorAll('.delete-button').forEach(button => {
    button.addEventListener('click', async () => {
      const url = button.getAttribute('data-url');
      try {
        const response = await fetch('/delete', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ url })
        });
        if (response.ok) {
          alert('File deleted');
          location.reload(); // Reload the page to update the gallery
        } else {
          alert('Failed to delete file');
        }
      } catch (err) {
        console.error('Error deleting file: ', err);
      }
    });
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'f' || e.key === 'F') {
      const navbar = document.querySelector('.navbar');
      if (navbar.style.display === 'none' || navbar.style.display === '') {
        navbar.style.display = 'flex';
        navbar.style.opacity = '1'; // Ensure visibility
        navbar.style.transform = 'translateX(0)'; // Slide in effect
      } else {
        navbar.style.opacity = '0'; // Fade out
        navbar.style.transform = 'translateX(100%)'; // Slide out effect
        setTimeout(() => navbar.style.display = 'none', 300); // Hide after transition
      }
    }
  });

  const currentPageLink = document.getElementById('current-page');
  if (currentPageLink) {
    currentPageLink.href = window.location.href;
  }
});

