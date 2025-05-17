const EditPost = {
    init: function() {
        $(document).ready(() => {
            this.initializeEditor();
            this.initializeSelect();
            this.bindEvents();
        });
    },
    initializeEditor: function() {
        if (typeof $.fn.trumbowyg === 'undefined') {
            console.error('Trumbowyg is not loaded');
            if ($('#postContent').length) {
                console.warn('Using standard textarea for #postContent');
                $('#postContent').attr('rows', 10);
            }
            
            return;
        }
        if ($('#postContent').length) {
            try {
                $('#postContent').trumbowyg({
                    btns: [
                        ['viewHTML'],
                        ['undo', 'redo'],
                        ['formatting'],
                        ['strong', 'em', 'del'],
                        ['link'],
                        ['insertImage'],
                        ['justifyLeft', 'justifyCenter', 'justifyRight'],
                        ['unorderedList', 'orderedList'],
                        ['table'],
                        ['fullscreen']
                    ],
                    autogrow: true,
                    urlProtocol: true,
                    removeformatPasted: true,
                    semantic: false, 
                    resetCss: true
                });
            } catch (error) {
                console.error('Error initializing Trumbowyg for #postContent:', error);
                $('#postContent').attr('rows', 10);
            }
        }
    },
    initializeSelect: function() {
        if (typeof $.fn.select2 === 'undefined') {
            console.error('Select2 is not loaded');
            return;
        }
        if ($('#postTags').length) {
            try {
                $('#postTags').select2({
                    placeholder: "Nhập thẻ và nhấn Enter để thêm",
                    tags: true, 
                    tokenSeparators: [',', ' ', '#'],
                    maximumSelectionLength: 5,
                    createTag: function(params) {
                        const term = $.trim(params.term);
                        if (term === '') {
                            return null;
                        }
                        let tagName = term;
                        if (tagName.startsWith('#')) {
                            tagName = tagName.substring(1);
                        }
                        tagName = tagName.trim().toLowerCase();
                        
                        if (!tagName) return null;
                        
                        return {
                            id: tagName,
                            text: tagName,
                            newTag: true
                        };
                    },
                    templateSelection: function(data) {
                        return $('<span>#' + data.text + '</span>');
                    },
                    ajax: {
                        url: '/discussion/hashtags',
                        dataType: 'json',
                        delay: 250,
                        data: function(params) {
                            return {
                                search: params.term
                            };
                        },
                        processResults: function(data) {
                            if (data && data.hashtags) {
                                return {
                                    results: data.hashtags.map(tag => ({
                                        id: tag.name,
                                        text: tag.name
                                    }))
                                };
                            }
                            return { results: [] };
                        },
                        cache: true
                    },
                    language: {
                        maximumSelected: function() {
                            return "Bạn chỉ có thể chọn tối đa 5 thẻ";
                        },
                        noResults: function() {
                            return "Không tìm thấy kết quả, nhấn Enter để tạo thẻ mới";
                        }
                    }
                });
            } catch (error) {
                console.error('Error initializing Select2 for #postTags:', error);
            }
        }
    },
    bindEvents: function() {
        const imageInput = document.getElementById('image');
        const removeImageCheckbox = document.getElementById('removeImage');
        
        if (removeImageCheckbox) {
            removeImageCheckbox.addEventListener('change', function() {
                if (this.checked) {
                    imageInput.disabled = true;
                } else {
                    imageInput.disabled = false;
                }
            });
        }
        $('#editPostForm').on('submit', this.handleFormSubmit.bind(this));
    },
    handleFormSubmit: async function(e) {
        e.preventDefault();
        const submitBtn = document.getElementById('submitBtn');
        const spinner = document.getElementById('submitSpinner');
        submitBtn.disabled = true;
        spinner.classList.remove('d-none');
        
        try {
            const form = $('#editPostForm')[0];
            const formData = new FormData(form);
            const postId = formData.get('postId');
            if (typeof $.fn.trumbowyg !== 'undefined' && $('#postContent').data('trumbowyg')) {
                const content = $('#postContent').trumbowyg('html');
                formData.set('content', content);
            }
            if (typeof $.fn.select2 !== 'undefined') {
                const hashtags = $('#postTags').select2('data').map(item => item.text).join(',');
                formData.set('hashtags', hashtags);
            }
            const response = await fetch(`/discussion/posts/${postId}`, {
                method: 'PUT',
                body: formData
            });
            const result = await response.json();
            if (result.success) {
                if (window.flashMessage) {
                    window.flashMessage.success('Bài viết đã được cập nhật thành công');
                } else {
                    alert('Bài viết đã được cập nhật thành công');
                }
                window.location.href = `/post/${postId}`;
            } else {
                if (window.flashMessage) {
                    window.flashMessage.error(result.message || 'Có lỗi xảy ra khi cập nhật bài viết');
                } else {
                    alert(result.message || 'Có lỗi xảy ra khi cập nhật bài viết');
                }
                submitBtn.disabled = false;
                spinner.classList.add('d-none');
            }
        } catch (error) {
            console.error('Error updating post:', error);
            if (window.flashMessage) {
                window.flashMessage.error('Có lỗi xảy ra khi cập nhật bài viết');
            } else {
                alert('Có lỗi xảy ra khi cập nhật bài viết');
            }
            submitBtn.disabled = false;
            spinner.classList.add('d-none');
        }
    },
    handleImagePreview: function(input) {
        if (input.files && input.files[0]) {
            const reader = new FileReader();
            const hasExistingImage = document.querySelector('.current-image');
            const previewContainer = hasExistingImage || document.querySelector('.preview-image');
            if (previewContainer) {
                previewContainer.classList.remove('d-none');
                reader.onload = function(e) {
                    const img = previewContainer.querySelector('img');
                    img.src = e.target.result;
                };
                reader.readAsDataURL(input.files[0]);
                const removeCheckbox = document.getElementById('removeImage');
                if (removeCheckbox) {
                    removeCheckbox.checked = false;
                }
            }
        }
    }
};

$(function() {
    if (typeof $ === 'undefined') {
        console.error('jQuery is not loaded');
        return;
    }
    if (typeof $.fn.trumbowyg === 'undefined' && typeof $ !== 'undefined') {
        console.warn('Trumbowyg not loaded - attempting to load dynamically');
        $('head').append('<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/trumbowyg@2.27.3/dist/ui/trumbowyg.min.css">');
        $.getScript('https://cdn.jsdelivr.net/npm/trumbowyg@2.27.3/dist/trumbowyg.min.js')
            .done(function() {
                EditPost.init();
            })
            .fail(function() {
                console.error('Failed to load Trumbowyg dynamically');
                EditPost.init();
            });
    } else {
        EditPost.init();
    }
    $('#image').on('change', function() {
        EditPost.handleImagePreview(this);
    });
});
