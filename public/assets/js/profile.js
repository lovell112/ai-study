document.addEventListener('DOMContentLoaded', function() {
    document.querySelectorAll('.btn-follow').forEach(button => {
        button.addEventListener('click', async function() {
            const userId = this.getAttribute('data-user-id');
            try {
                const response = await fetch('/api/user/follow', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ userId })
                });
                
                const data = await response.json();
                
                if (data.success) {
                    if (data.following) {
                        // User is now following - update to "Following" state
                        this.classList.add('active');
                        this.innerHTML = '<i class="fas fa-user-check me-1"></i> <span class="btn-text">Đang theo dõi</span>';
                    } else {
                        // User has unfollowed - update to "Follow" state
                        this.classList.remove('active');
                        this.innerHTML = '<i class="fas fa-user-plus me-1"></i> <span class="btn-text">Theo dõi</span>';
                    }
                    
                    // Apply responsive text adjustment for small screens
                    if (window.innerWidth <= 380) {
                        document.querySelectorAll('.btn-follow .btn-text').forEach(span => {
                            if (span.textContent === 'Đang theo dõi') {
                                span.textContent = 'Đang theo';
                            }
                        });
                    }
                    
                    // Reload page after a brief delay to update counters
                    setTimeout(() => {
                        window.location.reload();
                    }, 1000);
                    
                    if (window.flashMessage) {
                        window.flashMessage.success(data.message);
                    }
                }
            } catch (error) {
                console.error('Error following/unfollowing user:', error);
                if (window.flashMessage) {
                    window.flashMessage.error('Có lỗi xảy ra khi xử lý yêu cầu');
                }
            }
        });
    });

    document.querySelectorAll('.btn-save-post').forEach(button => {
        button.addEventListener('click', async function(e) {
            e.preventDefault();
            const postId = this.getAttribute('data-post-id');
            try {
                const response = await fetch('/api/user/save-post', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ postId })
                });
                
                const data = await response.json();
                
                if (data.success) {
                    if (data.saved) {
                        this.innerHTML = '<i class="fas fa-bookmark me-2"></i>Đã lưu';
                    } else {
                        this.innerHTML = '<i class="far fa-bookmark me-2"></i>Lưu bài đăng';
                    }
                    
                    if (window.flashMessage) {
                        window.flashMessage.success(data.message);
                    }
                }
            } catch (error) {
                console.error('Error saving post:', error);
                if (window.flashMessage) {
                    window.flashMessage.error('Có lỗi xảy ra khi xử lý yêu cầu');
                }
            }
        });
    });

    const loadMorePostsBtn = document.getElementById('loadMorePosts');
    if (loadMorePostsBtn) {
        loadMorePostsBtn.addEventListener('click', async function() {
            const page = parseInt(this.getAttribute('data-page')) || 1;
            const userId = this.getAttribute('data-user-id');
            
            try {
                const response = await fetch(`/api/user/${userId}/posts?page=${page+1}`);
                const data = await response.json();
                
                if (data.success && data.posts.length > 0) {
                    this.setAttribute('data-page', page + 1);
                    const postsContainer = document.getElementById('postsContainer');
                    data.posts.forEach(post => {
                        postsContainer.insertAdjacentHTML('beforeend', createPostHtml(post));
                    });
                    if (!data.hasMorePosts) {
                        this.style.display = 'none';
                    }
                }
            } catch (error) {
                console.error('Error loading more posts:', error);
            }
        });
    }
    
    function createPostHtml(post) {
        return `
            <div class="card mb-4" id="post-${post._id}">
                <!-- Post content would go here -->
                <div class="card-header bg-white">
                    <div class="d-flex align-items-center">
                        <img src="${post.author.avatar}" class="rounded-circle me-2" width="40" height="40" 
                             alt="${post.author.name}" onerror="this.onerror=null; this.src='/assets/images/avatars/default.png';">
                        <div>
                            <h6 class="mb-0">${post.author.name}</h6>
                            <small class="text-muted">${post.createdAtFormatted}</small>
                        </div>
                    </div>
                </div>
                <div class="card-body">
                    <h5 class="card-title">
                        <a href="/post/${post._id}" class="text-decoration-none text-dark">${post.title}</a>
                    </h5>
                    <p class="card-text">${post.contentPreview}</p>
                </div>
            </div>
        `;
    }
});