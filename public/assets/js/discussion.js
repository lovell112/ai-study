const Discussion = {
    init: function() {
        $(document).ready(() => {
            this.initializeEditors();
            this.initializeSelects();
            this.bindEvents();
            this.loadCategories();
        });
    },
    initializeEditors: function() {
        if (typeof $.fn.trumbowyg === 'undefined') {
            console.error('Trumbowyg is not loaded');
            if ($('#postContent').length) {
                console.warn('Using standard textarea for #postContent');
                $('#postContent').attr('rows', 7);
            }
            if ($('#commentReply').length) {
                console.warn('Using standard textarea for #commentReply');
            }
            
            return;
        }
        if ($('#postContent').length) {
            try {
                $('#postContent').trumbowyg({
                    btns: [
                        ['undo', 'redo'],
                        ['formatting'],
                        ['strong', 'em', 'del'],
                        ['link'],
                        ['insertImage'],
                        ['justifyLeft', 'justifyCenter', 'justifyRight'],
                        ['unorderedList', 'orderedList'],
                        ['horizontalRule'],
                        ['removeformat'],
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
                $('#postContent').attr('rows', 7);
            }
        }
        if ($('#commentReply').length) {
            try {
                $('#commentReply').trumbowyg({
                    btns: [
                        ['strong', 'em'],
                        ['link'],
                        ['unorderedList', 'orderedList'],
                    ],
                    autogrow: true,
                    removeformatPasted: true,
                    semantic: false,
                    resetCss: true
                });
            } catch (error) {
                console.error('Error initializing Trumbowyg for #commentReply:', error);
            }
        }
        if ($('#commentContent').length) {
            try {
                $('#commentContent').trumbowyg({
                    btns: [
                        ['strong', 'em'],
                        ['link'],
                        ['unorderedList', 'orderedList'],
                    ],
                    autogrow: true,
                    removeformatPasted: true,
                    semantic: false,
                    resetCss: true
                });
            } catch (error) {
                console.error('Error initializing Trumbowyg for #commentContent:', error);
            }
        }
    },
    initializeSelects: function() {
        if (typeof $.fn.select2 === 'undefined') {
            console.error('Select2 is not loaded');
            return;
        }
        if ($('#postCategory').length) {
            try {
                $('#postCategory').select2({
                    placeholder: "Chọn danh mục",
                    allowClear: true,
                    width: '100%',
                    language: {
                        noResults: function() {
                            return "Không tìm thấy kết quả";
                        }
                    }
                });
            } catch (error) {
                console.error('Error initializing Select2 for #postCategory:', error);
            }
        }
        if ($('#postTags').length) {
            try {
                $('#postTags').select2({
                    placeholder: "Nhập thẻ bất kỳ và nhấn Enter",
                    tags: true, 
                    tokenSeparators: [',', ' ', '#'], 
                    maximumSelectionLength: 5,
                    width: '100%',
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
                $('#postTags').data('placeholder', 'Nhập thẻ bất kỳ, không cần thêm dấu #');
            } catch (error) {
                console.error('Error initializing Select2 for #postTags:', error);
            }
        }
    },
    loadCategories: function() {
        if (!$('#postCategory').length) return;

        $.ajax({
            url: '/discussion/categories',
            type: 'GET',
            success: function(response) {
                if (response.success && response.categories) {
                    $('#postCategory').empty().append('<option value="">Chọn danh mục</option>');
                    response.categories.forEach(function(category) {
                        $('#postCategory').append(new Option(category.name, category._id));
                    });
                    $('#postCategory').trigger('change');
                }
            },
            error: function(error) {
                console.error('Error loading categories:', error);
                FuiToast.error('Không thể tải danh mục, vui lòng thử lại sau', {
                    duration: 3000,
                    isClose: true
                });
            }
        });
    },
    initializeSearchForm: function() {
        $('#searchForm').on('submit', function(e) {
            const query = $('input[name="q"]').val().trim();
            if (!query) {
                e.preventDefault();
                FuiToast.error('Vui lòng nhập từ khóa tìm kiếm', {
                    duration: 2000,
                    isClose: true,
                    style: {
                        color: "#000",
                    }
                });
            }
        });
        $('input[name="type"]').on('change', function() {
            const query = $('input[name="q"]').val().trim();
            if (query) {
                $('#searchForm').submit();
            }
        });
    },
    bindEvents: function() {
        const self = this;
        document.querySelectorAll('[data-bs-toggle="dropdown"]').forEach(dropdown => {
            new bootstrap.Dropdown(dropdown);
        });
        $('#submitPost').on('click', function() {
            self.submitPost();
        });
        $('.btn-like-post').on('click', function() {
            self.likePost($(this));
        });
        $('.comment-form').on('submit', function(e) {
            e.preventDefault();
            self.submitComment($(this));
        });
        $('.btn-reply').on('click', function() {
            const commentId = $(this).data('comment-id');
            const commentAuthor = $(this).data('comment-author');
            $('#replyTo').text(commentAuthor);
            $('#parentCommentId').val(commentId);
            $('#replyCommentModal').modal('show');
        });
        $('.btn-share-post').on('click', function() {
            const postId = $(this).data('post-id');
            const postUrl = `${window.location.origin}/post/${postId}`;
            const tempInput = $('<input>');
            $('body').append(tempInput);
            tempInput.val(postUrl).select();
            document.execCommand('copy');
            tempInput.remove();
            
            FuiToast.success('URL đã được sao chép vào clipboard', {
                duration: 2000,
                isClose: true,
                style: {
                    color: "#000",
                }
            });
        });
        $('.btn-follow-user').on('click', function() {
            const userId = $(this).data('user-id');
            const button = $(this);
            
            axios.post('/api/user/follow', { userId })
                .then(response => {
                    if (response.data.success) {
                        if (response.data.following) {
                            button.text('Đang theo dõi');
                            button.removeClass('btn-primary').addClass('btn-outline-secondary');
                        } else {
                            button.text('Theo dõi');
                            button.removeClass('btn-outline-secondary').addClass('btn-primary');
                        }
                    }
                })
                .catch(error => {
                    console.error('Error following user:', error);
                    FuiToast.error('Không thể theo dõi người dùng này', {
                        duration: 3000,
                        isClose: true
                    });
                });
        });
        $('#loadMorePosts').on('click', function() {
            self.loadMorePosts($(this));
        });
        $('#searchForm').on('submit', function(e) {
            e.preventDefault();
            self.searchPosts();
        });
        $('.btn-delete-post').on('click', function() {
            const postId = $(this).data('post-id');
            
            if (confirm('Bạn có chắc chắn muốn xóa bài viết này?')) {
                self.deletePost(postId);
            }
        });
        $('.btn-like-comment').on('click', function() {
            self.likeComment($(this));
        });
        $('#submitReply').on('click', function() {
            self.submitReply($(this));
        });
        $('.btn-save-post').on('click', function(e) {
            e.preventDefault();
            const postId = $(this).data('post-id');
            self.savePost(postId, $(this));
        });
        this.initializeSearchForm();
    },
    submitPost: function() {
        const title = $('#postTitle').val();
        let content;
        if ($.fn.trumbowyg && $('#postContent').data('trumbowyg')) {
            content = $('#postContent').trumbowyg('html');
        } else {
            content = $('#postContent').val();
        }
        
        const categoryId = $('#postCategory').val();
        const hashtags = $('#postTags').val();
        
        if (!title || !content || !categoryId) {
            window.flashMessage ? 
                window.flashMessage.error('Vui lòng điền đầy đủ thông tin (tiêu đề, nội dung, danh mục)') :
                FuiToast.error('Vui lòng điền đầy đủ thông tin (tiêu đề, nội dung, danh mục)', {
                    duration: 3000,
                    isClose: true
                });
            return;
        }

        const formData = new FormData();
        formData.append('title', title);
        formData.append('content', content);
        formData.append('categoryId', categoryId);
        
        if (hashtags && hashtags.length > 0) {
            hashtags.forEach(tag => {
                formData.append('hashtags', tag);
            });
        }
        
        const imageFile = $('#postImage')[0].files[0];
        if (imageFile) {
            formData.append('image', imageFile);
        }

        $('#submitPost').prop('disabled', true).html('<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Đang đăng...');

        axios.post('/discussion/create-post', formData, {
            headers: {
                'Content-Type': 'multipart/form-data'
            }
        })
        .then(response => {
            if (response.data.success) {
                $('#postTitle').val('');
                $('#postContent').trumbowyg('empty');
                $('#postCategory').val(null).trigger('change');
                $('#postTags').val(null).trigger('change');
                $('#postImage').val('');
                
                $('#createPostModal').modal('hide');
                
                FuiToast.success('Bài đăng của bạn đã được tạo thành công', {
                    duration: 3000,
                    isClose: true
                });
                
                setTimeout(() => {
                    location.reload();
                }, 1500);
            }
        })
        .catch(error => {
            console.error('Error creating post:', error);
            let errorMessage = 'Đã xảy ra lỗi khi tạo bài đăng';
            
            if (error.response && error.response.data && error.response.data.message) {
                errorMessage = error.response.data.message;
            }
            
            FuiToast.error(errorMessage, {
                duration: 3000,
                isClose: true
            });
        })
        .finally(() => {
            $('#submitPost').prop('disabled', false).html('Đăng');
        });
    },
    likePost: function(button) {
        const postId = button.data('post-id');
        
        axios.post('/discussion/like-post', { postId })
            .then(response => {
                if (response.data.success) {
                    const likesCount = response.data.likes;
                    const isLiked = response.data.liked;
                    
                    if (isLiked) {
                        button.addClass('active');
                        button.find('i').removeClass('far').addClass('fas');
                    } else {
                        button.removeClass('active');
                        button.find('i').removeClass('fas').addClass('far');
                    }
                    
                    button.find('.likes-count').text(likesCount);
                }
            })
            .catch(error => {
                console.error('Error liking post:', error);
                FuiToast.error('Không thể thích bài đăng này', {
                    duration: 3000,
                    isClose: true
                });
            });
    },
    likeComment: function(button) {
        const commentId = button.data('comment-id');
        
        axios.post('/discussion/like-comment', { commentId })
            .then(response => {
                if (response.data.success) {
                    const likesCount = response.data.likes;
                    const isLiked = response.data.liked;
                    
                    if (isLiked) {
                        button.addClass('active');
                        button.find('i').removeClass('far').addClass('fas');
                    } else {
                        button.removeClass('active');
                        button.find('i').removeClass('fas').addClass('far');
                    }
                    
                    button.find('.comment-likes-count').text(likesCount);
                }
            })
            .catch(error => {
                console.error('Error liking comment:', error);
                FuiToast.error('Không thể thích bình luận này', {
                    duration: 3000,
                    isClose: true
                });
            });
    },
    submitComment: function(form) {
        const postId = form.data('post-id');
        const commentInput = form.find('input[name="comment"]');
        const content = commentInput.val();
        
        if (!content || content.trim() === '') {
            FuiToast.error('Vui lòng nhập nội dung bình luận', {
                duration: 2000,
                isClose: true
            });
            return;
        }
        
        form.find('button').prop('disabled', true);
        
        axios.post('/discussion/add-comment', { postId, content })
            .then(response => {
                if (response.data.success) {
                    commentInput.val('');
                    
                    const newComment = response.data.comment;
                    const avatarPath = newComment.author.avatar || '/assets/images/avatars/default.png';
                    const profileUrl = newComment.author.username ? 
                        `/profile/${newComment.author.username}` : 
                        `/profile/${newComment.author._id}`;
                    
                    const commentHtml = `
                        <div class="card card-body bg-light mb-2">
                            <div class="d-flex mb-2">
                                <img src="${avatarPath}" class="rounded-circle me-2" alt="${newComment.author.name}" width="30" height="30">
                                <div>
                                    <h6 class="mb-0">
                                        <a href="${profileUrl}" class="text-decoration-none">${newComment.author.name}</a>
                                    </h6>
                                    <small class="text-muted">Vừa xong</small>
                                </div>
                            </div>
                            <p class="mb-0">${newComment.content}</p>
                            <div class="mt-2">
                                <button class="btn btn-sm btn-link btn-reply p-0" data-comment-id="${newComment._id}" data-comment-author="${newComment.author.name}">
                                    <i class="far fa-comment"></i> Trả lời
                                </button>
                                <button class="btn btn-sm btn-link p-0 ms-3 btn-like-comment" data-comment-id="${newComment._id}">
                                    <i class="far fa-heart"></i> <span class="comment-likes-count">0</span>
                                </button>
                            </div>
                        </div>
                    `;
                    
                    form.before(commentHtml);
                    
                    const countElement = $(`.comments-count[data-post-id="${postId}"]`);
                    if (countElement.length) {
                        const currentCount = parseInt(countElement.text()) || 0;
                        countElement.text(currentCount + 1);
                    }
                    $('.btn-reply').off('click').on('click', function() {
                        const commentId = $(this).data('comment-id');
                        const commentAuthor = $(this).data('comment-author');
                        $('#replyTo').text(commentAuthor);
                        $('#parentCommentId').val(commentId);
                        $('#replyCommentModal').modal('show');
                    });
                    
                    $('.btn-like-comment').off('click').on('click', function() {
                        Discussion.likeComment($(this));
                    });
                }
            })
            .catch(error => {
                console.error('Error adding comment:', error);
                FuiToast.error('Không thể thêm bình luận', {
                    duration: 3000,
                    isClose: true
                });
            })
            .finally(() => {
                form.find('button').prop('disabled', false);
            });
    },
    submitReply: function(button) {
        const commentId = $('#parentCommentId').val();
        let content;
        if ($.fn.trumbowyg && $('#commentReply').data('trumbowyg')) {
            content = $('#commentReply').trumbowyg('html');
        } else {
            content = $('#commentReply').val();
        }
        
        if (!content || content.trim() === '') {
            window.flashMessage ? 
                window.flashMessage.error('Vui lòng nhập nội dung phản hồi') :
                FuiToast.error('Vui lòng nhập nội dung phản hồi', {
                    duration: 3000,
                    isClose: true
                });
            return;
        }
        
        button.prop('disabled', true).html('<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Đang gửi...');
        
        axios.post('/discussion/reply-comment', { commentId, content })
            .then(response => {
                if (response.data.success) {
                    $('#replyCommentModal').modal('hide');
                    
                    $('#commentReply').trumbowyg('empty');
                    
                    window.flashMessage.success('Phản hồi đã được gửi thành công');
                    
                    const commentElement = $(`[data-comment-id="${commentId}"]`).closest('.comment');
                    
                    let repliesContainer = commentElement.find('.replies');
                    if (repliesContainer.length === 0) {
                        commentElement.find('.flex-grow-1').append('<div class="replies mt-2 ms-4"></div>');
                        repliesContainer = commentElement.find('.replies');
                    }
                    
                    const reply = response.data.reply;
                    const avatarPath = reply.author.avatar || '/assets/images/avatars/default.png';
                    const profileUrl = reply.author.username ? 
                        `/profile/${reply.author.username}` : 
                        `/profile/${reply.author._id}`;
                    
                    const replyHtml = `
                        <div class="reply mb-3">
                            <div class="d-flex">
                                <img src="${avatarPath}" class="rounded-circle me-2" width="30" height="30" alt="${reply.author.name}">
                                <div class="flex-grow-1">
                                    <div class="bg-light p-2 rounded">
                                        <div class="d-flex justify-content-between align-items-center mb-1">
                                            <h6 class="mb-0 fs-6">
                                                <a href="${profileUrl}" class="text-decoration-none">${reply.author.name}</a>
                                            </h6>
                                            <small class="text-muted">Vừa xong</small>
                                        </div>
                                        <div class="reply-content">
                                            ${reply.content}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    `;
                    
                    repliesContainer.append(replyHtml);
                }
            })
            .catch(error => {
                console.error('Error replying to comment:', error);
                window.flashMessage.error('Không thể gửi phản hồi');
            })
            .finally(() => {
                button.prop('disabled', false).text('Trả lời');
            });
    },
    loadMorePosts: function(button) {
        const page = button.data('page') || 1;
        const nextPage = page + 1;
        
        button.html('<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Đang tải...').prop('disabled', true);
        
        axios.get('/discussion', {
            params: { page: nextPage }
        })
        .then(response => {
        if (response.data && response.data.postsHtml) {
            $('#postsContainer').append(response.data.postsHtml);
            
            if (response.data.hasMore) {
                button.data('page', nextPage).html('Xem thêm bài đăng').prop('disabled', false);
            } else {
                button.parent().html('<p class="text-muted text-center">Không còn bài đăng nào để hiển thị</p>');
            }
            
            this.bindEvents();
            document.querySelectorAll('#postsContainer [data-bs-toggle="dropdown"]').forEach(dropdown => {
                new bootstrap.Dropdown(dropdown);
            });
        }
    })
        .catch(error => {
            console.error('Error loading more posts:', error);
            window.flashMessage.error('Không thể tải thêm bài đăng');
            button.html('Xem thêm bài đăng').prop('disabled', false);
        });
    },
    searchPosts: function() {
        const query = $('#searchQuery').val();
        const type = $('input[name="type"]:checked').val();
        
        if (!query || query.trim() === '') {
            return;
        }
        window.location.href = `/search-results?q=${encodeURIComponent(query)}&type=${type}`;
    },
    deletePost: function(postId) {
        axios.delete(`/discussion/posts/${postId}`)
            .then(response => {
                if (response.data.success) {
                    window.flashMessage.success('Bài đăng đã được xóa thành công');
                    
                    if (window.location.pathname.includes('/post/')) {
                        window.location.href = '/discussion';
                    } else {
                        $(`#post-${postId}`).fadeOut(300, function() {
                            $(this).remove();
                        });
                    }
                }
            })
            .catch(error => {
                console.error('Error deleting post:', error);
                window.flashMessage.error('Không thể xóa bài đăng');
            });
    },
    submitReport: function() {
        const postId = $('#reportedPostId').val();
        const reason = $('input[name="reason"]:checked').val();
        let details = '';
        
        if (reason === 'other') {
            details = $('#otherReason').val();
            if (!details || !details.trim()) {
                window.flashMessage.error('Vui lòng nêu rõ lý do báo cáo');
                return;
            }
        }
        
        $('#submitReport').prop('disabled', true).html('<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Đang gửi...');
        
        axios.post('/discussion/report', { postId, reason, details })
            .then(response => {
                if (response.data.success) {
                    $('#reportPostModal').modal('hide');
                    window.flashMessage.success('Báo cáo đã được gửi thành công');
                    
                    $('#otherReason').val('');
                    document.querySelector('input[name="reason"][value="inappropriate"]').checked = true;
                    $('#otherReasonGroup').hide();
                }
            })
            .catch(error => {
                console.error('Error reporting post:', error);
                window.flashMessage.error('Không thể gửi báo cáo');
            })
            .finally(() => {
                $('#submitReport').prop('disabled', false).text('Báo cáo');
            });
    },
    editPost: function(form, postId) {
        const title = form.find('#editPostTitle').val();
        let content;
        if ($.fn.trumbowyg && $('#editPostContent').data('trumbowyg')) {
            content = $('#editPostContent').trumbowyg('html');
        } else {
            content = $('#editPostContent').val();
        }
        
        const categoryId = form.find('#editPostCategory').val();
        const hashtags = form.find('#editPostTags').val();
        
        if (!title || !content || !categoryId) {
            window.flashMessage.error('Vui lòng điền đầy đủ thông tin (tiêu đề, nội dung, danh mục)');
            return;
        }

        const formData = new FormData();
        formData.append('title', title);
        formData.append('content', content);
        formData.append('categoryId', categoryId);
        
        if (hashtags && hashtags.length > 0) {
            hashtags.forEach(tag => {
                formData.append('hashtags', tag);
            });
        }
        
        const imageFile = form.find('#editPostImage')[0].files[0];
        if (imageFile) {
            formData.append('image', imageFile);
        }

        const submitButton = form.find('button[type="submit"]');
        submitButton.prop('disabled', true).html('<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Đang lưu...');

        axios.put(`/discussion/posts/${postId}`, formData, {
            headers: {
                'Content-Type': 'multipart/form-data'
            }
        })
        .then(response => {
            if (response.data.success) {
                window.flashMessage.success('Bài đăng đã được cập nhật thành công');
                
                window.location.href = `/post/${postId}`;
            }
        })
        .catch(error => {
            console.error('Error updating post:', error);
            let errorMessage = 'Đã xảy ra lỗi khi cập nhật bài đăng';
            
            if (error.response && error.response.data && error.response.data.message) {
                errorMessage = error.response.data.message;
            }
            
            window.flashMessage.error(errorMessage);
        })
        .finally(() => {
            submitButton.prop('disabled', false).html('Lưu thay đổi');
        });
    },
    followUser: function(button) {
        const userId = button.data('user-id');
        
        axios.post('/api/user/follow', { userId })
            .then(response => {
                if (response.data.success) {
                    if (response.data.following) {
                        button.text('Đang theo dõi');
                        button.removeClass('btn-primary').addClass('btn-outline-secondary');
                    } else {
                        button.text('Theo dõi');
                        button.removeClass('btn-outline-secondary').addClass('btn-primary');
                    }
                }
            })
            .catch(error => {
                console.error('Error following user:', error);
                window.flashMessage.error('Không thể theo dõi người dùng này');
            });
    },
    savePost: function(postId, button) {
        axios.post('/api/user/save-post', { postId })
            .then(response => {
                if (response.data.success) {
                    if (response.data.saved) {
                        button.html('<i class="fas fa-bookmark me-2"></i>Đã lưu');
                        FuiToast.success('Đã lưu bài đăng vào danh sách của bạn', {
                            duration: 2000,
                            isClose: true
                        });
                    } else {
                        button.html('<i class="far fa-bookmark me-2"></i>Lưu bài đăng');
                        FuiToast.success('Đã xóa bài đăng khỏi danh sách đã lưu', {
                            duration: 2000,
                            isClose: true
                        });
                    }
                }
            })
            .catch(error => {
                console.error('Error saving post:', error);
                FuiToast.error('Không thể lưu bài đăng', {
                    duration: 3000,
                    isClose: true
                });
            });
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
                Discussion.init();
            })
            .fail(function() {
                console.error('Failed to load Trumbowyg dynamically');
                Discussion.init();
            });
    } else {
        Discussion.init();
    }
});
