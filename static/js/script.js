document.addEventListener('DOMContentLoaded', function() {
    const form = document.getElementById('uploadForm');
    const fileInput = document.getElementById('fileInput');
    const dropZone = document.getElementById('dropZone');
    const fileUrlContainer = document.getElementById('fileUrlContainer');
    const fileUrlInput = document.getElementById('fileUrl');
    const copyButton = document.getElementById('copyButton');

    console.log('JavaScript loaded');

    form.addEventListener('submit', function(event) {
        event.preventDefault();
        uploadFiles();
    });

    fileInput.addEventListener('change', function() {
        console.log('File input changed');
        uploadFiles();
    });

    dropZone.addEventListener('dragover', function(event) {
        event.preventDefault();
        dropZone.classList.add('dragging');
    });

    dropZone.addEventListener('dragleave', function() {
        dropZone.classList.remove('dragging');
    });

    dropZone.addEventListener('drop', function(event) {
        event.preventDefault();
        dropZone.classList.remove('dragging');
        fileInput.files = event.dataTransfer.files;
        console.log('Files dropped:', fileInput.files);
        uploadFiles();
    });

    function uploadFiles() {
        if (fileInput.files.length === 0) {
            console.log('No files selected');
            alert('Please select a file.');
            return;
        }

        const formData = new FormData();
        for (let file of fileInput.files) {
            formData.append('file', file);
        }

        fetch('/upload', {
            method: 'POST',
            body: formData
        })
        .then(response => response.json())
        .then(data => {
            if (data.fileUrl) {
                fileUrlContainer.style.display = 'block';
                fileUrlInput.value = data.fileUrl;
            } else {
                alert('Failed to upload file.');
            }
        })
        .catch(error => console.error('Error uploading file:', error));
    }

    copyButton.addEventListener('click', function() {
        fileUrlInput.select();
        document.execCommand('copy');
    });
});
